//! Snippet expansion: when what you type in any app ends with a snippet keyword (e.g. ";sig"),
//! Esky deletes the keyword and pastes the snippet.
//!
//! A low-level keyboard hook sees keystrokes system-wide. Only the last few characters are kept,
//! in memory, to compare with the keywords; nothing typed is stored or sent anywhere.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, ToUnicode, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY,
    VK_BACK, VK_CAPITAL, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId, SetWindowsHookExW, KBDLLHOOKSTRUCT, LLKHF_INJECTED, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

/// Longest keyword Esky looks for; the typed buffer never holds more than this.
const MAX_KEYWORD: usize = 32;

struct State {
    app: Option<AppHandle>,
    keywords: Vec<String>,
    typed: String,
}

static STATE: Mutex<State> = Mutex::new(State { app: None, keywords: Vec::new(), typed: String::new() });

/// The keywords to watch for; empty turns expansion off.
pub fn set_keywords(keywords: Vec<String>) {
    let mut s = STATE.lock().unwrap();
    s.keywords = keywords.into_iter().filter(|k| !k.is_empty() && k.chars().count() <= MAX_KEYWORD).collect();
    s.typed.clear();
}

fn held(vk: VIRTUAL_KEY) -> bool {
    let state = unsafe { GetAsyncKeyState(vk.0 as i32) };
    state < 0
}

fn foreground_is_esky() -> bool {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid)) };
    pid == std::process::id()
}

/// The character a key produces with the current Shift / Caps Lock, without disturbing dead keys.
fn char_of(vk: u32, scan: u32) -> Option<char> {
    let mut state = [0u8; 256];
    if held(VK_SHIFT) {
        state[VK_SHIFT.0 as usize] = 0x80;
    }
    let caps_lock = unsafe { windows::Win32::UI::Input::KeyboardAndMouse::GetKeyState(VK_CAPITAL.0 as i32) } & 1 != 0;
    if caps_lock {
        state[VK_CAPITAL.0 as usize] = 0x01;
    }
    let mut buf = [0u16; 4];
    // Flag 4: don't change the keyboard state (keeps dead keys working in the app).
    let n = unsafe { ToUnicode(vk, scan, Some(&state), &mut buf, 4) };
    if n == 1 { char::from_u32(buf[0] as u32).filter(|c| !c.is_control()) } else { None }
}

unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && (wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN) {
        let k = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        // Keys Esky itself sends (pasting, deleting the keyword) don't count.
        if k.flags.0 & LLKHF_INJECTED.0 == 0 {
            on_key(k.vkCode, k.scanCode);
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

fn on_key(vk: u32, scan: u32) {
    let mut s = STATE.lock().unwrap();
    if s.keywords.is_empty() {
        return;
    }
    if vk == VK_BACK.0 as u32 {
        s.typed.pop();
        return;
    }
    // Shortcuts, Esky's own windows and keys that move the caret start over.
    if held(VK_CONTROL) || held(VK_MENU) || held(VK_LWIN) || held(VK_RWIN) || foreground_is_esky() {
        s.typed.clear();
        return;
    }
    let Some(c) = char_of(vk, scan) else {
        if ![VK_SHIFT.0, VK_CAPITAL.0, 0xA0, 0xA1].contains(&(vk as u16)) {
            s.typed.clear();
        }
        return;
    };
    s.typed.push(c);
    let extra = s.typed.chars().count().saturating_sub(MAX_KEYWORD);
    if extra > 0 {
        s.typed = s.typed.chars().skip(extra).collect();
    }
    let hit = s.keywords.iter().filter(|k| s.typed.ends_with(k.as_str())).max_by_key(|k| k.len()).cloned();
    if let (Some(kw), Some(app)) = (hit, s.app.clone()) {
        s.typed.clear();
        let _ = app.emit("snippet://typed", kw);
    }
}

/// Start the hook on its own thread (it needs a message loop).
pub fn start(app: AppHandle) {
    STATE.lock().unwrap().app = Some(app);
    std::thread::spawn(|| unsafe {
        if SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook), None, 0).is_err() {
            return;
        }
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
    });
}

/// Delete the typed keyword (`chars` Backspaces) in the app in front.
pub fn erase(chars: usize) {
    let key = |up: bool| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_BACK, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) }, time: 0, dwExtraInfo: 0 } },
    };
    let inputs: Vec<INPUT> = (0..chars).flat_map(|_| [key(false), key(true)]).collect();
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

/// The window in front, to paste the snippet into.
pub fn foreground() -> isize {
    unsafe { GetForegroundWindow() }.0 as isize
}
