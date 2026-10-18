//! System commands: lock, sleep, restart, shut down, sign out, the trash and removable drives.
//! Omarchy's own `omarchy-*` scripts are used when they exist, so Esky does what its menu does.

use super::util;
use std::path::PathBuf;

/// Run the first of `options` whose program is installed.
fn first_of(options: &[(&str, &[&str])]) -> Result<(), String> {
    for (prog, args) in options {
        if util::find(prog).is_some() {
            return util::run(prog, args).map(|_| ());
        }
    }
    Err("No program to do this was found".into())
}

pub fn lock() -> Result<(), String> {
    first_of(&[("omarchy-lock-screen", &[]), ("hyprlock", &[]), ("loginctl", &["lock-session"])])
}

pub fn sleep() -> Result<(), String> {
    util::run("systemctl", &["suspend"]).map(|_| ())
}

/// "restart", "shutdown" or "signout".
pub fn power(action: &str) -> Result<(), String> {
    match action {
        "restart" => first_of(&[("omarchy-system-reboot", &[]), ("systemctl", &["reboot"])]),
        "shutdown" => first_of(&[("omarchy-system-shutdown", &[]), ("systemctl", &["poweroff"])]),
        "signout" => first_of(&[("omarchy-system-logout", &[]), ("hyprctl", &["dispatch", "exit"])]),
        _ => Err("Unknown action".into()),
    }
}

#[derive(serde::Serialize)]
pub struct RecycleBin {
    pub items: i64,
    pub bytes: i64,
}

fn trash_files() -> PathBuf {
    let data = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join(".local/share"));
    data.join("Trash/files")
}

fn size_of(path: &std::path::Path) -> i64 {
    let Ok(meta) = std::fs::symlink_metadata(path) else { return 0 };
    if meta.is_dir() {
        std::fs::read_dir(path).map(|d| d.flatten().map(|e| size_of(&e.path())).sum()).unwrap_or(0)
    } else {
        meta.len() as i64
    }
}

/// What's in your trash folder.
pub fn recycle_bin() -> Result<RecycleBin, String> {
    let Ok(read) = std::fs::read_dir(trash_files()) else { return Ok(RecycleBin { items: 0, bytes: 0 }) };
    let entries: Vec<_> = read.flatten().collect();
    Ok(RecycleBin { items: entries.len() as i64, bytes: entries.iter().map(|e| size_of(&e.path())).sum() })
}

pub fn empty_recycle_bin() -> Result<(), String> {
    util::run("gio", &["trash", "--empty"]).map(|_| ())
}

#[derive(serde::Serialize)]
pub struct Drive {
    /// The device, e.g. "/dev/sdb1" (named `letter` to match the page, which got drive letters first).
    pub letter: String,
    pub label: String,
}

/// USB sticks, SD cards and other removable drives that are mounted.
pub fn removable_drives() -> Vec<Drive> {
    let Ok(out) = util::run("lsblk", &["-J", "-o", "PATH,LABEL,RM,HOTPLUG,MOUNTPOINT,TYPE"]) else { return vec![] };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&out) else { return vec![] };
    let flag = |d: &serde_json::Value, k: &str| d[k].as_bool().unwrap_or_else(|| d[k].as_str() == Some("1"));
    let mut found = Vec::new();
    fn walk(devs: &serde_json::Value, found: &mut Vec<Drive>, flag: &dyn Fn(&serde_json::Value, &str) -> bool) {
        for d in devs.as_array().into_iter().flatten() {
            let removable = flag(d, "rm") || flag(d, "hotplug");
            if removable && d["mountpoint"].is_string() {
                let path = d["path"].as_str().unwrap_or("").to_string();
                let label = d["label"].as_str().filter(|l| !l.is_empty()).map(String::from).unwrap_or_else(|| path.clone());
                found.push(Drive { letter: path, label });
            }
            walk(&d["children"], found, flag);
        }
    }
    walk(&v["blockdevices"], &mut found, &flag);
    found
}

/// Unmount a drive from `removable_drives`.
pub fn eject(device: &str) -> Result<(), String> {
    if !removable_drives().iter().any(|d| d.letter == device) {
        return Err("Not a removable drive".into());
    }
    util::run("udisksctl", &["unmount", "-b", device]).map(|_| ())
}
