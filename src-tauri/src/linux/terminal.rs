//! Opening a terminal: `xdg-terminal-exec` (Omarchy sets it up), else $TERMINAL, else the usual suspects.

use super::util;

const CANDIDATES: [&str; 8] = ["ghostty", "alacritty", "kitty", "foot", "wezterm", "gnome-terminal", "konsole", "xterm"];

/// A terminal in `cwd`, running `command` (or the shell when it's empty).
pub fn open(cwd: Option<&str>, command: &[&str]) -> Result<(), String> {
    if util::find("xdg-terminal-exec").is_some() {
        return util::spawn("xdg-terminal-exec", command, cwd);
    }
    let chosen = std::env::var("TERMINAL").ok().filter(|t| !t.is_empty() && util::find(t).is_some());
    let term = chosen.or_else(|| CANDIDATES.iter().find(|t| util::find(t).is_some()).map(|t| t.to_string()));
    let Some(term) = term else {
        return Err("Couldn't find a terminal. Install xdg-terminal-exec or set $TERMINAL".into());
    };
    if command.is_empty() {
        return util::spawn(&term, &[], cwd);
    }
    // gnome-terminal wants `--`; the rest take `-e`.
    let flag = if term == "gnome-terminal" { "--" } else { "-e" };
    let mut args = vec![flag];
    args.extend_from_slice(command);
    util::spawn(&term, &args, cwd)
}
