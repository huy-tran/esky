//! Switch Windows: the open app windows (as Alt Tab shows them), and bringing one to the front.

use windows::core::BOOL;
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, WPARAM};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindow, GetWindowLongW, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, PostMessageW, SetForegroundWindow, ShowWindow, BringWindowToTop, GWL_EXSTYLE, GW_OWNER, SW_RESTORE, WM_CLOSE, WS_EX_APPWINDOW,
    WS_EX_TOOLWINDOW,
};

#[derive(serde::Serialize)]
pub struct OpenWindow {
    pub id: isize,
    pub title: String,
    /// The program's .exe, for its name and icon.
    pub exe: Option<String>,
    pub minimized: bool,
}

fn pid_of(h: HWND) -> u32 {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(h, Some(&mut pid)) };
    pid
}

fn exe_of(pid: u32) -> Option<String> {
    unsafe {
        let proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(proc, PROCESS_NAME_WIN32, windows::core::PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(proc);
        ok.then(|| String::from_utf16_lossy(&buf[..len as usize]))
    }
}

/// A window Alt Tab would show: visible, not cloaked (other desktops, suspended Store apps),
/// titled, and either unowned or marked as an app window, and not a tool window.
fn is_app_window(h: HWND) -> bool {
    unsafe {
        if !IsWindowVisible(h).as_bool() || GetWindowTextLengthW(h) == 0 {
            return false;
        }
        let ex = GetWindowLongW(h, GWL_EXSTYLE) as u32;
        if ex & WS_EX_TOOLWINDOW.0 != 0 {
            return false;
        }
        let owned = GetWindow(h, GW_OWNER).map(|o| !o.0.is_null()).unwrap_or(false);
        if owned && ex & WS_EX_APPWINDOW.0 == 0 {
            return false;
        }
        let mut cloaked = 0u32;
        let _ = DwmGetWindowAttribute(h, DWMWA_CLOAKED, &mut cloaked as *mut _ as *mut _, 4);
        cloaked == 0
    }
}

unsafe extern "system" fn collect(h: HWND, data: LPARAM) -> BOOL {
    let list = unsafe { &mut *(data.0 as *mut Vec<HWND>) };
    list.push(h);
    true.into()
}

/// Open windows, most recently used first (the order Windows keeps them in).
pub fn list() -> Vec<OpenWindow> {
    let mut all: Vec<HWND> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut all as *mut _ as isize));
    }
    let me = std::process::id();
    all.into_iter()
        .filter(|&h| is_app_window(h) && pid_of(h) != me)
        .map(|h| {
            let mut buf = vec![0u16; unsafe { GetWindowTextLengthW(h) } as usize + 1];
            let n = unsafe { GetWindowTextW(h, &mut buf) } as usize;
            OpenWindow { id: h.0 as isize, title: String::from_utf16_lossy(&buf[..n]), exe: exe_of(pid_of(h)), minimized: unsafe { IsIconic(h) }.as_bool() }
        })
        .collect()
}

fn checked(id: isize) -> Result<HWND, String> {
    let h = HWND(id as *mut _);
    if !unsafe { IsWindow(Some(h)) }.as_bool() || pid_of(h) == std::process::id() {
        return Err("That window has closed".into());
    }
    Ok(h)
}

/// Bring a window to the front, restoring it if it's minimised.
pub fn focus(id: isize) -> Result<(), String> {
    let h = checked(id)?;
    unsafe {
        if IsIconic(h).as_bool() {
            let _ = ShowWindow(h, SW_RESTORE);
        }
        if SetForegroundWindow(h).as_bool() {
            return Ok(());
        }
        // Windows only lets the app in front hand over focus; borrow its input queue to do it.
        let front = GetForegroundWindow();
        let theirs = GetWindowThreadProcessId(front, None);
        let mine = GetCurrentThreadId();
        let _ = AttachThreadInput(mine, theirs, true);
        let _ = BringWindowToTop(h);
        let ok = SetForegroundWindow(h).as_bool();
        let _ = AttachThreadInput(mine, theirs, false);
        if ok { Ok(()) } else { Err("Windows didn't let Esky switch to that window".into()) }
    }
}

/// Ask a window to close, as its close button would (it can still ask to save).
pub fn close(id: isize) -> Result<(), String> {
    let h = checked(id)?;
    unsafe { PostMessageW(Some(h), WM_CLOSE, WPARAM(0), LPARAM(0)) }.map_err(|e| e.message().to_string())
}
