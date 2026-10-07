//! Colour Picker: the next click anywhere on screen picks that pixel's colour.
//! The click is swallowed (the app underneath doesn't get it); Esc or a right-click cancels.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use windows::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, CopyIcon, GetMessageW, LoadCursorW, PostThreadMessageW, SetSystemCursor, SetWindowsHookExW, SystemParametersInfoW,
    UnhookWindowsHookEx, HCURSOR, HICON, IDC_CROSS, KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, OCR_NORMAL, SPI_SETCURSORS,
    SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_QUIT, WM_RBUTTONDOWN,
    WM_RBUTTONUP,
};

#[derive(serde::Serialize, Clone, Copy)]
pub struct Picked {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// The hook thread, so the hooks can stop its message loop.
static THREAD: AtomicU32 = AtomicU32::new(0);
static RESULT: Mutex<Option<Option<Picked>>> = Mutex::new(None);

fn finish(picked: Option<Picked>) {
    *RESULT.lock().unwrap() = Some(picked);
    unsafe {
        let _ = PostThreadMessageW(THREAD.load(Ordering::Relaxed), WM_QUIT, WPARAM(0), LPARAM(0));
    }
}

fn pixel(p: POINT) -> Picked {
    unsafe {
        let dc = GetDC(None);
        let c = GetPixel(dc, p.x, p.y).0;
        ReleaseDC(None, dc);
        Picked { r: (c & 0xFF) as u8, g: ((c >> 8) & 0xFF) as u8, b: ((c >> 16) & 0xFF) as u8 }
    }
}

unsafe extern "system" fn mouse(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let m = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        match wparam.0 as u32 {
            WM_LBUTTONDOWN => {
                finish(Some(pixel(m.pt)));
                return LRESULT(1);
            }
            WM_RBUTTONDOWN => {
                finish(None);
                return LRESULT(1);
            }
            // The matching button-up shouldn't reach the app either.
            WM_LBUTTONUP | WM_RBUTTONUP => return LRESULT(1),
            _ => {}
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

unsafe extern "system" fn keyboard(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && wparam.0 as u32 == WM_KEYDOWN && (*(lparam.0 as *const KBDLLHOOKSTRUCT)).vkCode == 0x1B {
        finish(None);
        return LRESULT(1);
    }
    CallNextHookEx(None, code, wparam, lparam)
}

/// Which pick is running, so a timeout from an earlier one is ignored.
static GENERATION: AtomicU32 = AtomicU32::new(0);

/// Wait for a click and return its colour (None if cancelled or after 30 seconds).
/// Runs on its own thread: the hooks need a message loop.
pub fn pick() -> Option<Picked> {
    std::thread::spawn(pick_here).join().ok().flatten()
}

fn pick_here() -> Option<Picked> {
    *RESULT.lock().unwrap() = None;
    let generation = GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    unsafe {
        THREAD.store(GetCurrentThreadId(), Ordering::Relaxed);
        let mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse), None, 0).ok()?;
        let key_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard), None, 0).ok();
        // A crosshair while picking; Windows' own cursors come back afterwards.
        if let Ok(cross) = LoadCursorW(None, IDC_CROSS) {
            if let Ok(copy) = CopyIcon(HICON(cross.0)) {
                let _ = SetSystemCursor(HCURSOR(copy.0), OCR_NORMAL);
            }
        }
        let thread = GetCurrentThreadId();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(30));
            if GENERATION.load(Ordering::Relaxed) == generation {
                let _ = PostThreadMessageW(thread, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        });
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
        // This pick is over: its timeout must do nothing.
        GENERATION.fetch_add(1, Ordering::Relaxed);
        let _ = UnhookWindowsHookEx(mouse_hook);
        if let Some(k) = key_hook {
            let _ = UnhookWindowsHookEx(k);
        }
        let _ = SystemParametersInfoW(SPI_SETCURSORS, 0, None, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0));
    }
    RESULT.lock().unwrap().take().flatten()
}
