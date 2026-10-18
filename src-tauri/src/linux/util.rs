//! Running programs, and asking Hyprland about windows.

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// The first match for `name` on PATH.
pub fn find(name: &str) -> Option<PathBuf> {
    std::env::var_os("PATH")?.to_str()?.split(':').filter(|d| !d.is_empty()).map(|d| PathBuf::from(d).join(name)).find(|p| p.is_file())
}

fn missing(prog: &str, e: std::io::Error) -> String {
    if e.kind() == std::io::ErrorKind::NotFound {
        format!("`{prog}` isn't installed")
    } else {
        format!("Couldn't run `{prog}`: {e}")
    }
}

/// stdout of `prog args`, or what it said on stderr when it failed.
pub fn run(prog: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(prog).args(args).stdin(Stdio::null()).output().map_err(|e| missing(prog, e))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if msg.is_empty() { format!("`{prog}` failed") } else { msg })
    }
}

/// Like `run`, for output that is bytes (images).
pub fn run_bytes(prog: &str, args: &[&str]) -> Result<Vec<u8>, String> {
    let out = Command::new(prog).args(args).stdin(Stdio::null()).stderr(Stdio::null()).output().map_err(|e| missing(prog, e))?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(format!("`{prog}` failed"))
    }
}

/// Start a program and leave it running on its own.
pub fn spawn(prog: &str, args: &[&str], cwd: Option<&str>) -> Result<(), String> {
    let mut cmd = Command::new(prog);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let mut child = cmd.spawn().map_err(|e| missing(prog, e))?;
    // Reaped on its own thread, so finished programs don't linger as zombies.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

/// Run `prog args` with `input` on its stdin and wait for it to exit. For `wl-copy`, which hands the
/// clipboard to a background copy of itself: its output must not be piped, or this would wait for that copy.
pub fn feed(prog: &str, args: &[&str], input: &[u8]) -> Result<(), String> {
    let mut child = Command::new(prog).args(args).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| missing(prog, e))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input).map_err(|e| e.to_string())?;
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("`{prog}` failed"))
    }
}

/// `hyprctl <args> -j` as JSON.
pub fn hypr_json(args: &[&str]) -> Result<serde_json::Value, String> {
    let mut all = args.to_vec();
    all.push("-j");
    serde_json::from_str(&run("hyprctl", &all)?).map_err(|e| e.to_string())
}

/// `hyprctl dispatch <args>`. Hyprland answers "ok", or says what was wrong.
pub fn hypr_dispatch(args: &[&str]) -> Result<(), String> {
    let mut all = vec!["dispatch"];
    all.extend_from_slice(args);
    let out = run("hyprctl", &all)?;
    if out.trim() == "ok" {
        Ok(())
    } else {
        Err(out.trim().to_string())
    }
}

/// A Hyprland window address ("0x5586b3c9d0f0") as the number the page keeps for a window.
pub fn parse_addr(s: &str) -> Option<isize> {
    usize::from_str_radix(s.trim_start_matches("0x"), 16).ok().map(|n| n as isize)
}

/// The address Hyprland's dispatchers take for a window.
pub fn addr_arg(id: isize) -> String {
    format!("address:0x{:x}", id as usize)
}

/// The windows Hyprland has open, most recently focused first.
pub fn clients() -> Vec<serde_json::Value> {
    let mut list = hypr_json(&["clients"]).ok().and_then(|v| v.as_array().cloned()).unwrap_or_default();
    list.sort_by_key(|c| c["focusHistoryID"].as_i64().unwrap_or(i64::MAX));
    list
}
