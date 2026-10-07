//! Clipboard History: notices each copy (text, images, files), saves images to disk, and tells the
//! page. Also puts history entries back on the clipboard for pasting.

use crate::input::{self, Snapshot, CF_UNICODETEXT};
use base64::Engine;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use windows::core::{HSTRING, PWSTR};
use windows::Win32::Foundation::{HGLOBAL, HWND};
use windows::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, GetClipboardOwner, GetClipboardSequenceNumber, IsClipboardFormatAvailable,
    RegisterClipboardFormatW,
};
use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};
use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::UI::Shell::{DragQueryFileW, HDROP};
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

const CF_DIB: u32 = 8;
const CF_HDROP: u32 = 15;

/// Off until the page turns it on (Settings → Clipboard → Clipboard history).
static WATCHING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Copied {
    pub kind: &'static str, // "text" | "image" | "files"
    pub text: Option<String>,
    pub files: Option<Vec<String>>,
    /// Saved PNG for images, and a small preview of it.
    pub image_file: Option<String>,
    pub thumb: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub bytes: Option<u64>,
    pub app_path: Option<String>,
    /// Marked "don't record" by the app that copied it (password managers do this).
    pub sensitive: bool,
}

pub fn set_watching(on: bool) {
    WATCHING.store(on, Ordering::Relaxed);
}

fn format_id(name: &str) -> u32 {
    unsafe { RegisterClipboardFormatW(&HSTRING::from(name)) }
}

fn available(f: u32) -> bool {
    unsafe { IsClipboardFormatAvailable(f) }.is_ok()
}

/// Password managers and other private apps mark their copies so clipboard tools skip them.
fn is_sensitive() -> bool {
    if available(format_id("ExcludeClipboardContentFromMonitorProcessing")) || available(format_id("Clipboard Viewer Ignore")) {
        return true;
    }
    // Windows' own "CanIncludeInClipboardHistory" = 0 means the same.
    let f = format_id("CanIncludeInClipboardHistory");
    if !available(f) || !input::open_clipboard() {
        return false;
    }
    let no = unsafe {
        GetClipboardData(f).ok().is_some_and(|h| {
            let g = HGLOBAL(h.0);
            let p = GlobalLock(g) as *const u32;
            let v = !p.is_null() && *p == 0;
            let _ = GlobalUnlock(g);
            v
        })
    };
    unsafe {
        let _ = CloseClipboard();
    }
    no
}

fn owner_path() -> Option<String> {
    let hwnd: HWND = unsafe { GetClipboardOwner() }.ok()?;
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    unsafe { QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len) }.ok()?;
    Some(String::from_utf16_lossy(&buf[..len as usize]))
}

fn read_bytes(format: u32) -> Option<Vec<u8>> {
    if !input::open_clipboard() {
        return None;
    }
    let out = unsafe {
        GetClipboardData(format).ok().and_then(|h| {
            let g = HGLOBAL(h.0);
            let size = GlobalSize(g);
            let p = GlobalLock(g) as *const u8;
            let v = (!p.is_null() && size > 0).then(|| std::slice::from_raw_parts(p, size).to_vec());
            let _ = GlobalUnlock(g);
            v
        })
    };
    unsafe {
        let _ = CloseClipboard();
    }
    out
}

fn read_files() -> Option<Vec<String>> {
    if !input::open_clipboard() {
        return None;
    }
    let files = unsafe {
        GetClipboardData(CF_HDROP).ok().map(|h| {
            let drop = HDROP(h.0);
            let n = DragQueryFileW(drop, u32::MAX, None);
            (0..n)
                .map(|i| {
                    let mut buf = vec![0u16; DragQueryFileW(drop, i, None) as usize + 1];
                    let len = DragQueryFileW(drop, i, Some(&mut buf));
                    String::from_utf16_lossy(&buf[..len as usize])
                })
                .collect::<Vec<_>>()
        })
    };
    unsafe {
        let _ = CloseClipboard();
    }
    files.filter(|f| !f.is_empty())
}

/// A device-independent bitmap as straight RGBA, top row first.
fn dib_to_rgba(dib: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    let u32_at = |o: usize| dib.get(o..o + 4).map(|b| u32::from_le_bytes(b.try_into().unwrap()));
    let header = u32_at(0)? as usize;
    let w = i32::from_le_bytes(dib.get(4..8)?.try_into().ok()?);
    let h = i32::from_le_bytes(dib.get(8..12)?.try_into().ok()?);
    let bpp = u16::from_le_bytes(dib.get(14..16)?.try_into().ok()?);
    let compression = u32_at(16)?;
    let colors = u32_at(32).unwrap_or(0) as usize;
    if w <= 0 || h == 0 || !(bpp == 24 || bpp == 32) {
        return None;
    }
    let (w, top_down, h) = (w as usize, h < 0, h.unsigned_abs() as usize);
    // BI_BITFIELDS adds three colour masks after a 40-byte header.
    let masks = if compression == 3 && header == 40 { 12 } else { 0 };
    let start = header + masks + colors * 4;
    let stride = (w * bpp as usize / 8).div_ceil(4) * 4;
    let px = dib.get(start..start + stride * h)?;
    let mut out = vec![0u8; w * h * 4];
    let mut any_alpha = false;
    for y in 0..h {
        let row = &px[(if top_down { y } else { h - 1 - y }) * stride..];
        for x in 0..w {
            let (b, g, r, a) = if bpp == 32 {
                let p = &row[x * 4..x * 4 + 4];
                (p[0], p[1], p[2], p[3])
            } else {
                let p = &row[x * 3..x * 3 + 3];
                (p[0], p[1], p[2], 255)
            };
            any_alpha |= a != 0;
            out[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&[r, g, b, a]);
        }
    }
    // Screenshots often leave alpha at 0 for every pixel: that means opaque.
    if bpp == 32 && !any_alpha {
        out.chunks_exact_mut(4).for_each(|p| p[3] = 255);
    }
    Some((w as u32, h as u32, out))
}

fn encode_png(w: u32, h: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut enc = png::Encoder::new(&mut out, w, h);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header().ok()?;
    writer.write_image_data(rgba).ok()?;
    drop(writer);
    Some(out)
}

/// A preview no bigger than `max` pixels on its longest side.
fn thumbnail(w: u32, h: u32, rgba: &[u8], max: u32) -> Option<Vec<u8>> {
    let scale = (max as f32 / w.max(h) as f32).min(1.0);
    let (tw, th) = (((w as f32 * scale) as u32).max(1), ((h as f32 * scale) as u32).max(1));
    let mut out = vec![0u8; (tw * th * 4) as usize];
    for y in 0..th {
        for x in 0..tw {
            let (sx, sy) = ((x as f32 / scale) as u32, (y as f32 / scale) as u32);
            let s = ((sy.min(h - 1) * w + sx.min(w - 1)) * 4) as usize;
            let d = ((y * tw + x) * 4) as usize;
            out[d..d + 4].copy_from_slice(&rgba[s..s + 4]);
        }
    }
    encode_png(tw, th, &out)
}

/// What's on the clipboard now, or None when it's nothing Esky records.
fn read(images: &Path, id: u32) -> Option<Copied> {
    let sensitive = is_sensitive();
    let app_path = owner_path();
    let mut c = Copied { kind: "text", text: None, files: None, image_file: None, thumb: None, width: None, height: None, bytes: None, app_path, sensitive };
    if sensitive {
        return Some(c);
    }
    if available(CF_HDROP) {
        c.kind = "files";
        c.files = Some(read_files()?);
        return Some(c);
    }
    if available(CF_UNICODETEXT) {
        c.text = input::read_text().filter(|t| !t.trim().is_empty());
        return c.text.is_some().then_some(c);
    }
    if available(CF_DIB) {
        let (w, h, rgba) = dib_to_rgba(&read_bytes(CF_DIB)?)?;
        let png = encode_png(w, h, &rgba)?;
        std::fs::create_dir_all(images).ok()?;
        let file = images.join(format!("{id}-{}.png", std::process::id()));
        std::fs::write(&file, &png).ok()?;
        c.kind = "image";
        c.bytes = Some(png.len() as u64);
        c.image_file = Some(file.to_string_lossy().into_owned());
        c.thumb = thumbnail(w, h, &rgba, 360).map(|t| format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(t)));
        (c.width, c.height) = (Some(w), Some(h));
        return Some(c);
    }
    None
}

/// Watch for copies (polling the clipboard's change counter is cheap) and emit `clipboard://copied`.
pub fn start(app: AppHandle, images: PathBuf) {
    std::thread::spawn(move || {
        let mut seen = unsafe { GetClipboardSequenceNumber() };
        loop {
            std::thread::sleep(Duration::from_millis(300));
            let seq = unsafe { GetClipboardSequenceNumber() };
            if seq == seen {
                continue;
            }
            seen = seq;
            if !WATCHING.load(Ordering::Relaxed) || input::is_quiet() {
                continue;
            }
            // Let the app finish writing every format.
            std::thread::sleep(Duration::from_millis(60));
            if let Some(c) = read(&images, seq) {
                let _ = app.emit("clipboard://copied", c);
            }
        }
    });
}

// Putting history entries back.

fn rgba_to_dib(w: u32, h: u32, rgba: &[u8]) -> Vec<u8> {
    let mut dib = Vec::with_capacity(40 + rgba.len());
    for v in [40u32, w, h] {
        dib.extend_from_slice(&v.to_le_bytes());
    }
    dib.extend_from_slice(&1u16.to_le_bytes()); // planes
    dib.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
    dib.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    dib.extend_from_slice(&((w * h * 4) as u32).to_le_bytes());
    dib.extend_from_slice(&[0u8; 16]);
    // Bottom row first, BGRA.
    for y in (0..h as usize).rev() {
        for p in rgba[y * w as usize * 4..(y + 1) * w as usize * 4].chunks_exact(4) {
            dib.extend_from_slice(&[p[2], p[1], p[0], p[3]]);
        }
    }
    dib
}

fn image_formats(file: &str) -> Result<Snapshot, String> {
    let decoder = png::Decoder::new(std::io::BufReader::new(std::fs::File::open(file).map_err(|_| "That image is no longer saved")?));
    let mut reader = decoder.read_info().map_err(|e| e.to_string())?;
    let mut buf = vec![0; reader.output_buffer_size().ok_or("Image too large")?];
    let info = reader.next_frame(&mut buf).map_err(|e| e.to_string())?;
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
        png::ColorType::Rgb => buf[..info.buffer_size()].chunks_exact(3).flat_map(|p| [p[0], p[1], p[2], 255]).collect(),
        _ => return Err("Unsupported image".into()),
    };
    Ok(vec![(CF_DIB, rgba_to_dib(info.width, info.height, &rgba))])
}

fn files_formats(files: &[String]) -> Snapshot {
    // DROPFILES header (20 bytes, wide paths) followed by the paths, each ending in 0, then one more 0.
    let mut data = Vec::new();
    data.extend_from_slice(&20u32.to_le_bytes());
    data.extend_from_slice(&[0u8; 8]); // drop point
    data.extend_from_slice(&0u32.to_le_bytes()); // fNC
    data.extend_from_slice(&1u32.to_le_bytes()); // fWide
    for f in files {
        data.extend(input::utf16(f));
    }
    data.extend_from_slice(&[0, 0]);
    vec![(CF_HDROP, data)]
}

/// A history entry as clipboard formats: text, an image file, or a list of files.
pub fn entry_formats(text: Option<String>, image_file: Option<String>, files: Option<Vec<String>>) -> Result<Snapshot, String> {
    if let Some(f) = image_file {
        return image_formats(&f);
    }
    if let Some(fs) = files {
        return Ok(files_formats(&fs));
    }
    Ok(vec![(CF_UNICODETEXT, input::utf16(&text.unwrap_or_default()))])
}

/// Text on the clipboard that clipboard tools (Esky's own history, Windows' Win+V) don't record.
pub fn copy_private(text: &str) {
    input::put(&vec![
        (CF_UNICODETEXT, input::utf16(text)),
        (format_id("ExcludeClipboardContentFromMonitorProcessing"), vec![0, 0, 0, 0]),
        (format_id("CanIncludeInClipboardHistory"), vec![0, 0, 0, 0]),
    ]);
}

