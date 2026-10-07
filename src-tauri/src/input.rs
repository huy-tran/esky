//! The app you were in before Esky opened: read its selected text, and paste into it.
//!
//! Both go through the clipboard (Ctrl C / Ctrl V sent to that app), and the clipboard is put back
//! afterwards so nothing you had copied is lost.

use std::thread::sleep;
use std::time::{Duration, Instant};
use windows::core::PWSTR;
use windows::Win32::Foundation::{HANDLE, HGLOBAL, HWND};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, EnumClipboardFormats, GetClipboardData, GetClipboardSequenceNumber, OpenClipboard,
    SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY,
    VK_C, VK_CONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_MENU, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT, VK_V,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow};

const CF_UNICODETEXT: u32 = 13;
/// Formats that are GDI handles rather than memory; Windows recreates them from CF_DIB / CF_TEXT.
const GDI_FORMATS: [u32; 4] = [2, 3, 9, 14]; // BITMAP, METAFILEPICT, PALETTE, ENHMETAFILE

#[derive(serde::Serialize)]
pub struct Target {
    /// The .exe of the app, for showing its name.
    pub app_path: Option<String>,
    /// What was selected in it, when asked for.
    pub selection: Option<String>,
}

fn key(vk: VIRTUAL_KEY, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) }, time: 0, dwExtraInfo: 0 },
        },
    }
}

/// Press Ctrl + `vk` in the foreground app. Modifiers still held from Esky's hotkey (Alt, Shift, Win)
/// are released first; Ctrl goes down before Alt comes up, so the app doesn't open its menu bar.
fn send_ctrl(vk: VIRTUAL_KEY) {
    let held = |k: VIRTUAL_KEY| unsafe { GetAsyncKeyState(k.0 as i32) } < 0;
    let mut inputs = vec![key(VK_CONTROL, false)];
    for k in [VK_MENU, VK_LMENU, VK_RMENU, VK_SHIFT, VK_LSHIFT, VK_RSHIFT, VK_LWIN, VK_RWIN] {
        if held(k) {
            inputs.push(key(k, true));
        }
    }
    inputs.extend([key(vk, false), key(vk, true), key(VK_CONTROL, true)]);
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

fn open_clipboard() -> bool {
    // Another app may be holding it for a moment.
    for _ in 0..20 {
        if unsafe { OpenClipboard(None) }.is_ok() {
            return true;
        }
        sleep(Duration::from_millis(10));
    }
    false
}

/// Everything on the clipboard, format by format, so it can be put back.
type Snapshot = Vec<(u32, Vec<u8>)>;

fn snapshot() -> Snapshot {
    let mut out = Vec::new();
    if !open_clipboard() {
        return out;
    }
    unsafe {
        let mut f = EnumClipboardFormats(0);
        while f != 0 {
            if !GDI_FORMATS.contains(&f) {
                if let Ok(h) = GetClipboardData(f) {
                    let g = HGLOBAL(h.0);
                    let size = GlobalSize(g);
                    let p = GlobalLock(g) as *const u8;
                    if !p.is_null() && size > 0 {
                        out.push((f, std::slice::from_raw_parts(p, size).to_vec()));
                    }
                    let _ = GlobalUnlock(g);
                }
            }
            f = EnumClipboardFormats(f);
        }
        let _ = CloseClipboard();
    }
    out
}

fn put(formats: &Snapshot) {
    if !open_clipboard() {
        return;
    }
    unsafe {
        let _ = EmptyClipboard();
        for (f, bytes) in formats {
            if let Ok(g) = GlobalAlloc(GMEM_MOVEABLE, bytes.len()) {
                let p = GlobalLock(g) as *mut u8;
                if !p.is_null() {
                    std::ptr::copy_nonoverlapping(bytes.as_ptr(), p, bytes.len());
                    let _ = GlobalUnlock(g);
                    // The clipboard owns the memory from here.
                    let _ = SetClipboardData(*f, Some(HANDLE(g.0)));
                }
            }
        }
        let _ = CloseClipboard();
    }
}

fn utf16(text: &str) -> Vec<u8> {
    text.encode_utf16().chain(std::iter::once(0)).flat_map(u16::to_le_bytes).collect()
}

fn read_text() -> Option<String> {
    if !open_clipboard() {
        return None;
    }
    let text = unsafe {
        GetClipboardData(CF_UNICODETEXT).ok().and_then(|h| {
            let g = HGLOBAL(h.0);
            let p = GlobalLock(g) as *const u16;
            let s = (!p.is_null()).then(|| {
                let len = (0..).take_while(|&i| *p.add(i) != 0).count();
                String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
            });
            let _ = GlobalUnlock(g);
            s
        })
    };
    unsafe {
        let _ = CloseClipboard();
    }
    text
}

fn exe_of(hwnd: HWND) -> Option<String> {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    unsafe { QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len) }.ok()?;
    Some(String::from_utf16_lossy(&buf[..len as usize]))
}

fn is_ours(hwnd: HWND) -> bool {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    pid == std::process::id()
}

/// Remember the app in front (unless it's Esky) and, if asked, read its selected text.
/// Returns the window to paste into later.
pub fn capture(read_selection: bool) -> (Option<isize>, Target) {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() || is_ours(hwnd) {
        return (None, Target { app_path: None, selection: None });
    }
    let app_path = exe_of(hwnd);
    let mut selection = None;
    if read_selection {
        let before = snapshot();
        let seq = unsafe { GetClipboardSequenceNumber() };
        send_ctrl(VK_C);
        // Apps answer Ctrl C within a few milliseconds; nothing selected means nothing changes.
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(150) {
            if unsafe { GetClipboardSequenceNumber() } != seq {
                sleep(Duration::from_millis(15));
                selection = read_text().filter(|t| !t.trim().is_empty());
                put(&before);
                break;
            }
            sleep(Duration::from_millis(5));
        }
    }
    (Some(hwnd.0 as isize), Target { app_path, selection })
}

/// Put `text` into the remembered app as if typed: clipboard, Ctrl V, then the old clipboard back.
pub fn paste(target: isize, text: &str) -> Result<(), String> {
    let hwnd = HWND(target as *mut _);
    if !unsafe { IsWindow(Some(hwnd)) }.as_bool() {
        return Err("That window has closed".into());
    }
    let before = snapshot();
    put(&vec![(CF_UNICODETEXT, utf16(text))]);
    // Esky hides first; give Windows a moment before switching back.
    sleep(Duration::from_millis(60));
    let _ = unsafe { SetForegroundWindow(hwnd) };
    sleep(Duration::from_millis(60));
    send_ctrl(VK_V);
    // Let the app read the clipboard before restoring it.
    sleep(Duration::from_millis(350));
    put(&before);
    Ok(())
}

