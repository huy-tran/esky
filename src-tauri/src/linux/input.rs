//! The app you were in before Esky opened: read its selected text, and paste into it.
//!
//! Wayland apps can't be typed into from outside, so pasting puts the text on the clipboard (wl-copy),
//! focuses the window and has Hyprland send it Ctrl V (Ctrl Shift V in terminals). The clipboard is
//! put back afterwards.

use super::{apps, util};
use std::thread::sleep;
use std::time::{Duration, Instant};

/// Clipboard contents as (mime type, bytes). Only the first type is put back: wl-copy offers one.
pub type Snapshot = Vec<(String, Vec<u8>)>;

#[derive(serde::Serialize)]
pub struct Target {
    /// The app's name, for showing it.
    pub app_path: Option<String>,
    /// What was selected in it, when asked for.
    pub selection: Option<String>,
}

/// Until when clipboard changes are Esky's own (pasting), so Clipboard History doesn't record them.
static QUIET_UNTIL: std::sync::Mutex<Option<Instant>> = std::sync::Mutex::new(None);

pub fn quiet_for(ms: u64) {
    let until = Instant::now() + Duration::from_millis(ms);
    let mut q = QUIET_UNTIL.lock().unwrap();
    if q.map_or(true, |t| t < until) {
        *q = Some(until);
    }
}

pub fn is_quiet() -> bool {
    QUIET_UNTIL.lock().unwrap().is_some_and(|t| Instant::now() < t)
}

/// The clipboard types, best first: what is worth keeping and putting back.
const PREFERRED: [&str; 4] = ["image/png", "text/uri-list", "text/plain;charset=utf-8", "text/plain"];

pub fn snapshot() -> Snapshot {
    let Ok(types) = util::run("wl-paste", &["--list-types"]) else { return vec![] };
    let types: Vec<&str> = types.lines().collect();
    for want in PREFERRED {
        if types.contains(&want) {
            if let Ok(bytes) = util::run_bytes("wl-paste", &["--no-newline", "--type", want]) {
                return vec![(want.to_string(), bytes)];
            }
        }
    }
    vec![]
}

pub fn put(formats: &Snapshot) {
    let Some((mime, bytes)) = formats.first() else {
        let _ = util::run("wl-copy", &["--clear"]);
        return;
    };
    // Without --type, wl-copy offers text under every name apps ask for.
    let _ = if mime.starts_with("text/plain") { util::feed("wl-copy", &[], bytes) } else { util::feed("wl-copy", &["--type", mime], bytes) };
}

/// The window Hyprland has focused, as (address, class).
fn active() -> Option<(isize, String)> {
    let w = util::hypr_json(&["activewindow"]).ok()?;
    let id = util::parse_addr(w["address"].as_str()?)?;
    if w["pid"].as_u64() == Some(std::process::id() as u64) {
        return None;
    }
    Some((id, w["class"].as_str().unwrap_or("").to_string()))
}

/// Remember the app in front (unless it's Esky) and, if asked, read its selected text.
/// Returns the window to paste into later.
pub fn capture(read_selection: bool) -> (Option<isize>, Target) {
    let Some((id, class)) = active() else { return (None, Target { app_path: None, selection: None }) };
    // The primary selection is whatever is highlighted, with no Ctrl C needed.
    let selection = if read_selection {
        util::run("wl-paste", &["--primary", "--no-newline"]).ok().filter(|t| !t.trim().is_empty())
    } else {
        None
    };
    let name = apps::name_for_class(&class).or(Some(class).filter(|c| !c.is_empty()));
    (Some(id), Target { app_path: name, selection })
}

const TERMINALS: [&str; 10] = ["alacritty", "kitty", "ghostty", "foot", "wezterm", "xterm", "konsole", "gnome-terminal", "terminator", "st-256color"];

fn is_terminal(id: isize) -> bool {
    let want = util::addr_arg(id);
    util::clients().iter().any(|c| {
        let addr = c["address"].as_str().and_then(util::parse_addr).map(util::addr_arg);
        addr.as_deref() == Some(want.as_str()) && {
            let class = c["class"].as_str().unwrap_or("").to_lowercase();
            TERMINALS.iter().any(|t| class.contains(t))
        }
    })
}

fn send_paste(id: isize) -> Result<(), String> {
    let keys = if is_terminal(id) { "CTRL SHIFT" } else { "CTRL" };
    let shortcut = format!("{keys}, V, {}", util::addr_arg(id));
    if util::hypr_dispatch(&["sendshortcut", &shortcut]).is_ok() {
        return Ok(());
    }
    // Older Hyprland has no sendshortcut; wtype types into whatever has focus, which is the target by now.
    if keys == "CTRL" {
        util::run("wtype", &["-M", "ctrl", "-k", "v", "-m", "ctrl"]).map(|_| ())
    } else {
        util::run("wtype", &["-M", "ctrl", "-M", "shift", "-k", "v", "-m", "shift", "-m", "ctrl"]).map(|_| ())
    }
}

/// Put `text` into the remembered app as if typed: clipboard, Ctrl V, then the old clipboard back.
pub fn paste(target: isize, text: &str) -> Result<(), String> {
    paste_formats(target, &vec![("text/plain;charset=utf-8".to_string(), text.as_bytes().to_vec())])
}

/// Paste any clipboard content (text, an image, files) into the remembered app.
pub fn paste_formats(target: isize, formats: &Snapshot) -> Result<(), String> {
    if target == 0 {
        return Err("There's no app to paste into".into());
    }
    let open = util::clients().iter().any(|c| c["address"].as_str().and_then(util::parse_addr) == Some(target));
    if !open {
        return Err("That window has closed".into());
    }
    quiet_for(1200);
    let before = snapshot();
    put(formats);
    // Esky hides first; give Hyprland a moment before switching back.
    sleep(Duration::from_millis(60));
    util::hypr_dispatch(&["focuswindow", &util::addr_arg(target)])?;
    sleep(Duration::from_millis(80));
    let sent = send_paste(target);
    // Let the app read the clipboard before restoring it.
    sleep(Duration::from_millis(350));
    put(&before);
    sent
}
