//! Installed apps, from the Start menu's "All apps" list (`shell:AppsFolder`): desktop and
//! Microsoft Store apps alike. Every entry is launched the same way, through its AppsFolder id.

use base64::Engine;
use std::collections::HashMap;
use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::SIZE;
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
};
use windows::Win32::Storage::EnhancedStorage::PKEY_Link_TargetParsingPath;
use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    BHID_EnumItems, IEnumShellItems, IShellItem, IShellItem2, IShellItemImageFactory,
    SHCreateItemFromParsingName, ShellExecuteW, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
    SIIGBF, SIIGBF_ICONONLY,
};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

#[derive(serde::Serialize)]
pub struct App {
    /// AppsFolder id: an AppUserModelID, or a known-folder path for older desktop apps.
    pub id: String,
    pub name: String,
    /// The .exe (or file) the Start menu entry points at, when Windows knows it. Store apps have none.
    pub path: Option<String>,
}

/// COM for the current thread, released on drop.
struct Com(bool);
impl Com {
    fn init() -> Self {
        Com(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok())
    }
}
impl Drop for Com {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize() }
        }
    }
}

fn take(p: PWSTR) -> String {
    let s = unsafe { p.to_string() }.unwrap_or_default();
    unsafe { CoTaskMemFree(Some(p.0 as _)) };
    s
}

fn err(e: windows::core::Error) -> String {
    e.message().to_string()
}

/// Start menu entries that aren't apps: uninstallers and links to documents or web pages.
fn is_noise(name: &str, path: Option<&str>) -> bool {
    let n = name.to_lowercase();
    if n.contains("uninstall") || n.starts_with("repair ") {
        return true;
    }
    let Some(p) = path.map(str::to_lowercase) else { return false };
    p.contains("uninst")
        || [".chm", ".txt", ".pdf", ".htm", ".html", ".url", ".rtf", ".md"].iter().any(|ext| p.ends_with(ext))
        || p.starts_with("http:")
        || p.starts_with("https:")
}

pub fn list() -> Result<Vec<App>, String> {
    let _com = Com::init();
    unsafe {
        let folder: IShellItem = SHCreateItemFromParsingName(&HSTRING::from("shell:AppsFolder"), None).map_err(err)?;
        let items: IEnumShellItems = folder.BindToHandler(None, &BHID_EnumItems).map_err(err)?;
        let mut apps = Vec::new();
        loop {
            let mut batch: [Option<IShellItem>; 1] = [None];
            let mut fetched = 0u32;
            if items.Next(&mut batch, Some(&mut fetched)).is_err() || fetched == 0 {
                break;
            }
            let Some(item) = batch[0].take() else { break };
            let (Ok(name), Ok(id)) = (item.GetDisplayName(SIGDN_NORMALDISPLAY), item.GetDisplayName(SIGDN_PARENTRELATIVEPARSING)) else {
                continue;
            };
            let (name, id) = (take(name), take(id));
            let path = item
                .cast::<IShellItem2>()
                .ok()
                .and_then(|i| i.GetString(&PKEY_Link_TargetParsingPath).ok())
                .map(take)
                // "::{GUID}" is a shell location (File Explorer, Control Panel), not a file.
                .filter(|p| !p.is_empty() && !p.starts_with("::"));
            if name.is_empty() || is_noise(&name, path.as_deref()) {
                continue;
            }
            apps.push(App { id, name, path });
        }
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        apps.dedup_by(|a, b| a.id == b.id);
        Ok(apps)
    }
}

fn shell_execute(verb: &str, target: &str) -> Result<(), String> {
    let r = unsafe { ShellExecuteW(None, &HSTRING::from(verb), &HSTRING::from(target), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL) };
    // ShellExecute reports success as a value above 32.
    if r.0 as isize > 32 {
        Ok(())
    } else {
        Err(format!("Windows couldn't open it (code {})", r.0 as isize))
    }
}

pub fn launch(id: &str) -> Result<(), String> {
    let _com = Com::init();
    shell_execute("open", &format!("shell:AppsFolder\\{id}"))
}

/// Run the app's .exe elevated. Windows shows its usual UAC prompt.
pub fn launch_admin(path: &str) -> Result<(), String> {
    let _com = Com::init();
    shell_execute("runas", path)
}

/// The app's icon as a PNG data URL, `size` pixels square.
fn icon(id: &str, size: i32) -> Result<String, String> {
    shell_image(&format!("shell:AppsFolder\\{id}"), size, true)
}

/// The picture Windows shows for anything the Shell can parse (an app, a file), as a PNG data URL.
/// `icon_only` gives the icon; otherwise a thumbnail of the content when there is one (photos, PDFs).
pub fn shell_image(parsing_name: &str, size: i32, icon_only: bool) -> Result<String, String> {
    unsafe {
        let factory: IShellItemImageFactory = SHCreateItemFromParsingName(&HSTRING::from(parsing_name), None).map_err(err)?;
        let flags = if icon_only { SIIGBF_ICONONLY } else { SIIGBF(0) };
        let hbm = factory.GetImage(SIZE { cx: size, cy: size }, flags).map_err(err)?;
        let png = bitmap_png(hbm);
        let _ = DeleteObject(HGDIOBJ(hbm.0));
        Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png?)))
    }
}

/// `shell_image` with COM set up for this call.
pub fn shell_image_once(parsing_name: &str, size: i32, icon_only: bool) -> Result<String, String> {
    let _com = Com::init();
    shell_image(parsing_name, size, icon_only)
}

/// Icons for many apps at once, on a few threads (each needs its own COM). Apps without an icon are left out.
pub fn icons(ids: &[String], size: i32) -> HashMap<String, String> {
    let chunk = ids.len().div_ceil(4).max(1);
    std::thread::scope(|s| {
        let parts: Vec<_> = ids
            .chunks(chunk)
            .map(|part| {
                s.spawn(move || {
                    let _com = Com::init();
                    part.iter().filter_map(|id| icon(id, size).ok().map(|i| (id.clone(), i))).collect::<Vec<_>>()
                })
            })
            .collect();
        parts.into_iter().flat_map(|p| p.join().unwrap_or_default()).collect()
    })
}

unsafe fn bitmap_png(hbm: HBITMAP) -> Result<Vec<u8>, String> {
    let mut bm = BITMAP::default();
    if GetObjectW(HGDIOBJ(hbm.0), std::mem::size_of::<BITMAP>() as i32, Some(&mut bm as *mut _ as *mut _)) == 0 {
        return Err("Unreadable icon".into());
    }
    let (w, h) = (bm.bmWidth, bm.bmHeight.abs());
    let mut info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w,
            biHeight: -h, // top-down rows
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let mut px = vec![0u8; (w * h * 4) as usize];
    let dc = GetDC(None);
    let rows = GetDIBits(dc, hbm, 0, h as u32, Some(px.as_mut_ptr() as *mut _), &mut info, DIB_RGB_COLORS);
    ReleaseDC(None, dc);
    if rows == 0 {
        return Err("Unreadable icon".into());
    }
    // BGRA with premultiplied alpha -> straight RGBA.
    for p in px.chunks_exact_mut(4) {
        let a = p[3] as u32;
        let (b, g, r) = (p[0] as u32, p[1] as u32, p[2] as u32);
        let un = |c: u32| if a == 0 { 0 } else { (c * 255 / a).min(255) as u8 };
        p[0] = un(r);
        p[1] = un(g);
        p[2] = un(b);
    }
    let mut out = Vec::new();
    let mut enc = png::Encoder::new(&mut out, w as u32, h as u32);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header().map_err(|e| e.to_string())?;
    writer.write_image_data(&px).map_err(|e| e.to_string())?;
    drop(writer);
    Ok(out)
}

