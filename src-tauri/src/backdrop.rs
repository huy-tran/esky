//! The launcher's Acrylic background: the windows behind it, blurred. Windows 11's own Acrylic
//! backdrop (DWMSBT_TRANSIENTWINDOW) looks almost like Mica behind the panel, and the older
//! acrylic accent comes out a flat grey, so this uses the plain blur-behind accent policy
//! (SetWindowCompositionAttribute). The page's panel colour, at the opacity from Settings, is
//! the tint. It can lag while a window is dragged or resized, which the launcher never is.

use std::ffi::c_void;
use windows::core::{s, w, BOOL};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_SYSTEMBACKDROP_TYPE, DWM_SYSTEMBACKDROP_TYPE};
use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};

#[repr(C)]
struct AccentPolicy {
    state: u32,
    flags: u32,
    /// AABBGGRR
    gradient: u32,
    animation: u32,
}

#[repr(C)]
struct CompositionData {
    attribute: u32,
    data: *mut c_void,
    size: usize,
}

const WCA_ACCENT_POLICY: u32 = 19;
const ACCENT_DISABLED: u32 = 0;
const ACCENT_ENABLE_BLURBEHIND: u32 = 3;
const DWMSBT_NONE: DWM_SYSTEMBACKDROP_TYPE = DWM_SYSTEMBACKDROP_TYPE(1);

type SetWindowCompositionAttribute = unsafe extern "system" fn(HWND, *mut CompositionData) -> BOOL;

fn accent(hwnd: HWND, state: u32) -> Result<(), String> {
    unsafe {
        let user32 = GetModuleHandleW(w!("user32.dll")).map_err(|e| e.message().to_string())?;
        let f = GetProcAddress(user32, s!("SetWindowCompositionAttribute")).ok_or("This version of Windows can't blur windows")?;
        let set: SetWindowCompositionAttribute = std::mem::transmute(f);
        let mut policy = AccentPolicy { state, flags: 0, gradient: 0, animation: 0 };
        let mut data = CompositionData { attribute: WCA_ACCENT_POLICY, data: &mut policy as *mut _ as *mut c_void, size: std::mem::size_of::<AccentPolicy>() };
        if set(hwnd, &mut data).as_bool() { Ok(()) } else { Err("Windows refused the blur".into()) }
    }
}

/// Blur what's behind the window.
pub fn apply_blur(hwnd: isize) -> Result<(), String> {
    let h = HWND(hwnd as *mut _);
    // No system backdrop, or it's drawn over the blur.
    unsafe {
        let _ = DwmSetWindowAttribute(h, DWMWA_SYSTEMBACKDROP_TYPE, &DWMSBT_NONE as *const _ as *const c_void, 4);
    }
    accent(h, ACCENT_ENABLE_BLURBEHIND)
}

pub fn clear(hwnd: isize) {
    let _ = accent(HWND(hwnd as *mut _), ACCENT_DISABLED);
}
