//! System commands: lock, sleep, restart, shut down, sign out, Recycle Bin, ejecting drives.

use std::os::windows::process::CommandExt;
use std::process::Command;
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW};
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::UI::Shell::{
    SHEmptyRecycleBinW, SHQueryRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI, SHERB_NOSOUND, SHQUERYRBINFO,
};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const DRIVE_REMOVABLE: u32 = 2;

fn err(e: windows::core::Error) -> String {
    e.message().to_string()
}

pub fn lock() -> Result<(), String> {
    unsafe { LockWorkStation() }.map_err(err)
}

pub fn sleep() -> Result<(), String> {
    // Sleep, not hibernate; wake events stay enabled.
    if unsafe { SetSuspendState(false, false, false) } {
        Ok(())
    } else {
        Err(windows::core::Error::from_thread().message().to_string())
    }
}

/// Restart, shut down or sign out through shutdown.exe, which asks open apps to close as usual.
pub fn power(action: &str) -> Result<(), String> {
    let args: &[&str] = match action {
        "restart" => &["/r", "/t", "0"],
        "shutdown" => &["/s", "/t", "0"],
        "signout" => &["/l"],
        _ => return Err("Unknown action".into()),
    };
    Command::new("shutdown.exe")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct RecycleBin {
    pub items: i64,
    pub bytes: i64,
}

/// What's in the Recycle Bin across all drives.
pub fn recycle_bin() -> Result<RecycleBin, String> {
    let mut info = SHQUERYRBINFO { cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32, ..Default::default() };
    unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }.map_err(err)?;
    Ok(RecycleBin { items: info.i64NumItems, bytes: info.i64Size })
}

pub fn empty_recycle_bin() -> Result<(), String> {
    let r = unsafe { SHEmptyRecycleBinW(None, PCWSTR::null(), SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND) };
    // Emptying an already empty bin reports an error; that's fine.
    match r {
        Ok(()) => Ok(()),
        Err(_) if recycle_bin().map(|b| b.items == 0).unwrap_or(false) => Ok(()),
        Err(e) => Err(err(e)),
    }
}

#[derive(serde::Serialize)]
pub struct Drive {
    /// "E:"
    pub letter: String,
    pub label: String,
}

/// USB sticks, SD cards and other removable drives.
pub fn removable_drives() -> Vec<Drive> {
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8)
        .filter(|i| mask & (1 << i) != 0)
        .map(|i| format!("{}:", (b'A' + i) as char))
        .filter(|d| unsafe { GetDriveTypeW(&HSTRING::from(format!("{d}\\"))) } == DRIVE_REMOVABLE)
        .map(|letter| {
            let mut name = [0u16; 261];
            let ok = unsafe { GetVolumeInformationW(&HSTRING::from(format!("{letter}\\")), Some(&mut name), None, None, None, None) }.is_ok();
            let label = if ok { String::from_utf16_lossy(&name[..name.iter().position(|&c| c == 0).unwrap_or(0)]) } else { String::new() };
            Drive { letter, label }
        })
        .collect()
}

/// Eject one drive the way File Explorer's "Eject" does, so Windows flushes it first.
pub fn eject(letter: &str) -> Result<(), String> {
    if !(letter.len() == 2 && letter.as_bytes()[0].is_ascii_alphabetic() && letter.ends_with(':')) {
        return Err("Not a drive letter".into());
    }
    let script = format!("(New-Object -ComObject Shell.Application).Namespace(17).ParseName('{letter}').InvokeVerb('Eject')");
    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

