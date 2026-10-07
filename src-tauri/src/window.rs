//! Window Layouts: move and size the app you were in (halves, thirds, centre, maximise, next display).

use std::collections::HashMap;
use std::sync::Mutex;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows::Win32::Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow, HDC, HMONITOR, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows::core::BOOL;
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, IsIconic, IsWindow, IsZoomed, SetWindowPos, ShowWindow, SWP_NOACTIVATE, SWP_NOZORDER, SW_MAXIMIZE, SW_RESTORE,
};

/// Where each window was before Esky first moved it, for "Restore".
static ORIGINAL: Mutex<Option<HashMap<isize, RECT>>> = Mutex::new(None);

fn work_area(m: HMONITOR) -> RECT {
    let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
    let _ = unsafe { GetMonitorInfoW(m, &mut info) };
    info.rcWork
}

fn window_rect(h: HWND) -> RECT {
    let mut r = RECT::default();
    let _ = unsafe { GetWindowRect(h, &mut r) };
    r
}

/// How far the window's invisible resize border sticks out on each side (Windows 10/11).
fn shadow(h: HWND) -> (i32, i32, i32, i32) {
    let outer = window_rect(h);
    let mut visible = RECT::default();
    let ok = unsafe { DwmGetWindowAttribute(h, DWMWA_EXTENDED_FRAME_BOUNDS, &mut visible as *mut _ as *mut _, std::mem::size_of::<RECT>() as u32) }.is_ok();
    if !ok {
        return (0, 0, 0, 0);
    }
    (visible.left - outer.left, visible.top - outer.top, outer.right - visible.right, outer.bottom - visible.bottom)
}

/// Put the window's visible edges exactly on `r`.
fn place(h: HWND, r: RECT) {
    if unsafe { IsZoomed(h) }.as_bool() || unsafe { IsIconic(h) }.as_bool() {
        let _ = unsafe { ShowWindow(h, SW_RESTORE) };
    }
    let (l, t, rr, b) = shadow(h);
    let _ = unsafe { SetWindowPos(h, None, r.left - l, r.top - t, r.right - r.left + l + rr, r.bottom - r.top + t + b, SWP_NOZORDER | SWP_NOACTIVATE) };
}

fn remember(h: HWND) {
    let mut o = ORIGINAL.lock().unwrap();
    o.get_or_insert_with(HashMap::new).entry(h.0 as isize).or_insert_with(|| window_rect(h));
}

fn monitors() -> Vec<HMONITOR> {
    unsafe extern "system" fn add(m: HMONITOR, _: HDC, _: *mut RECT, list: LPARAM) -> BOOL {
        (*(list.0 as *mut Vec<HMONITOR>)).push(m);
        true.into()
    }
    let mut list: Vec<HMONITOR> = Vec::new();
    let _ = unsafe { EnumDisplayMonitors(None, None, Some(add), LPARAM(&mut list as *mut _ as isize)) };
    // Left to right, then top to bottom.
    list.sort_by_key(|m| {
        let r = work_area(*m);
        (r.left, r.top)
    });
    list
}

/// `layout` is "maximize", "restore", "center", "next-display", or a rectangle in percent of the
/// screen's work area: [left, top, width, height].
pub fn apply(target: isize, layout: &str, rect: Option<[f64; 4]>) -> Result<(), String> {
    let h = HWND(target as *mut _);
    if !unsafe { IsWindow(Some(h)) }.as_bool() {
        return Err("That window has closed".into());
    }
    let area = work_area(unsafe { MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST) });
    let (aw, ah) = (area.right - area.left, area.bottom - area.top);
    match layout {
        "maximize" => {
            remember(h);
            let _ = unsafe { ShowWindow(h, SW_MAXIMIZE) };
        }
        "restore" => {
            let original = ORIGINAL.lock().unwrap().as_mut().and_then(|o| o.remove(&(h.0 as isize)));
            match original {
                Some(r) => {
                    if unsafe { IsZoomed(h) }.as_bool() {
                        let _ = unsafe { ShowWindow(h, SW_RESTORE) };
                    }
                    let _ = unsafe { SetWindowPos(h, None, r.left, r.top, r.right - r.left, r.bottom - r.top, SWP_NOZORDER | SWP_NOACTIVATE) };
                }
                None => {
                    let _ = unsafe { ShowWindow(h, SW_RESTORE) };
                }
            }
        }
        "center" => {
            remember(h);
            if unsafe { IsZoomed(h) }.as_bool() {
                let _ = unsafe { ShowWindow(h, SW_RESTORE) };
            }
            let r = window_rect(h);
            let (w, hh) = ((r.right - r.left).min(aw), (r.bottom - r.top).min(ah));
            let (x, y) = (area.left + (aw - w) / 2, area.top + (ah - hh) / 2);
            let _ = unsafe { SetWindowPos(h, None, x, y, w, hh, SWP_NOZORDER | SWP_NOACTIVATE) };
        }
        "next-display" => {
            let list = monitors();
            if list.len() < 2 {
                return Err("There's only one display".into());
            }
            let current = unsafe { MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST) };
            let i = list.iter().position(|m| *m == current).unwrap_or(0);
            let to = work_area(list[(i + 1) % list.len()]);
            let maximized = unsafe { IsZoomed(h) }.as_bool();
            if maximized {
                let _ = unsafe { ShowWindow(h, SW_RESTORE) };
            }
            // Same place and size relative to each screen.
            let r = window_rect(h);
            let (tw, th) = (to.right - to.left, to.bottom - to.top);
            let sx = |v: i32| to.left + ((v - area.left) as f64 * tw as f64 / aw as f64) as i32;
            let sy = |v: i32| to.top + ((v - area.top) as f64 * th as f64 / ah as f64) as i32;
            let _ = unsafe { SetWindowPos(h, None, sx(r.left), sy(r.top), sx(r.right) - sx(r.left), sy(r.bottom) - sy(r.top), SWP_NOZORDER | SWP_NOACTIVATE) };
            if maximized {
                let _ = unsafe { ShowWindow(h, SW_MAXIMIZE) };
            }
        }
        "rect" => {
            let [x, y, w, hh] = rect.ok_or("No layout given")?;
            remember(h);
            let px = |p: f64, total: i32| (p / 100.0 * total as f64).round() as i32;
            place(h, RECT { left: area.left + px(x, aw), top: area.top + px(y, ah), right: area.left + px(x + w, aw), bottom: area.top + px(y + hh, ah) });
        }
        _ => return Err("Unknown layout".into()),
    }
    Ok(())
}
