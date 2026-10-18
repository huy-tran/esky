//! Snippet expansion needs to see every key you type, which Wayland doesn't allow apps to do.
//! These are stand-ins so the rest of Esky builds the same; snippets still paste from the launcher.

use tauri::AppHandle;

pub fn set_keywords(_keywords: Vec<String>) {}

pub fn start(_app: AppHandle) {}

pub fn erase(_chars: usize) {}

pub fn foreground() -> isize {
    0
}
