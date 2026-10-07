//! File Search: an in-memory index of file names in the folders you choose, plus Windows' Recent files.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use windows::core::HSTRING;
use windows::Win32::Storage::EnhancedStorage::PKEY_Link_TargetParsingPath;
use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, CoUninitialize, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{IShellItem2, SHCreateItemFromParsingName};

/// Folders never worth searching: dependencies, build output, version control.
const SKIP: [&str; 14] = ["node_modules", "vendor", ".git", ".svn", ".hg", "target", "dist", ".nuxt", ".output", ".next", "__pycache__", ".venv", "bin", "obj"];
const MAX_FILES: usize = 300_000;
const MAX_DEPTH: usize = 12;

#[derive(Clone, serde::Serialize)]
pub struct FileHit {
    pub path: String,
    pub name: String,
    pub size: u64,
    /// Last modified (ms since 1970).
    pub modified: u64,
}

struct Entry {
    path: PathBuf,
    lower: String,
    size: u64,
    modified: u64,
}

static INDEX: Mutex<Vec<Entry>> = Mutex::new(Vec::new());

fn ms(t: Option<SystemTime>) -> u64 {
    t.and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map_or(0, |d| d.as_millis() as u64)
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<Entry>) {
    if depth > MAX_DEPTH || out.len() >= MAX_FILES {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && name != ".env" {
            continue;
        }
        let Ok(t) = e.file_type() else { continue };
        if t.is_dir() {
            if !SKIP.contains(&name.as_str()) {
                walk(&e.path(), depth + 1, out);
            }
        } else if t.is_file() {
            let meta = e.metadata().ok();
            out.push(Entry {
                path: e.path(),
                lower: name.to_lowercase(),
                size: meta.as_ref().map_or(0, |m| m.len()),
                modified: ms(meta.and_then(|m| m.modified().ok())),
            });
        }
    }
}

/// Re-read the folders. Returns how many files are indexed.
pub fn rebuild(roots: &[PathBuf]) -> usize {
    let mut fresh = Vec::new();
    for r in roots {
        walk(r, 0, &mut fresh);
    }
    let n = fresh.len();
    *INDEX.lock().unwrap() = fresh;
    n
}

fn hit(e: &Entry) -> FileHit {
    FileHit {
        path: e.path.to_string_lossy().into_owned(),
        name: e.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        size: e.size,
        modified: e.modified,
    }
}

/// Files whose name contains every word of `query`: names starting with it first, then the newest.
pub fn search(query: &str, limit: usize) -> Vec<FileHit> {
    let words: Vec<String> = query.to_lowercase().split_whitespace().map(String::from).collect();
    if words.is_empty() {
        return vec![];
    }
    let index = INDEX.lock().unwrap();
    let mut found: Vec<(u8, &Entry)> = index
        .iter()
        .filter(|e| words.iter().all(|w| e.lower.contains(w.as_str())))
        .map(|e| {
            let score = if e.lower.starts_with(&words[0]) { 2 } else if e.lower.contains(&format!(" {}", words[0])) { 1 } else { 0 };
            (score, e)
        })
        .collect();
    found.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.modified.cmp(&a.1.modified)));
    found.into_iter().take(limit).map(|(_, e)| hit(e)).collect()
}

/// Files you opened recently, from Windows' Recent folder (shortcuts to the real files).
pub fn recent(limit: usize) -> Vec<FileHit> {
    let Some(dir) = std::env::var_os("APPDATA").map(|a| PathBuf::from(a).join("Microsoft\\Windows\\Recent")) else { return vec![] };
    let Ok(entries) = std::fs::read_dir(dir) else { return vec![] };
    let mut links: Vec<(u64, PathBuf)> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("lnk")))
        .map(|e| (ms(e.metadata().ok().and_then(|m| m.modified().ok())), e.path()))
        .collect();
    links.sort_by(|a, b| b.0.cmp(&a.0));
    let com = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok();
    let out = links
        .into_iter()
        .filter_map(|(_, lnk)| {
            let item: IShellItem2 = unsafe { SHCreateItemFromParsingName(&HSTRING::from(lnk.as_os_str()), None) }.ok()?;
            let p = unsafe { item.GetString(&PKEY_Link_TargetParsingPath) }.ok()?;
            let target = unsafe { p.to_string() }.ok();
            unsafe { CoTaskMemFree(Some(p.0 as _)) };
            let target = PathBuf::from(target?);
            let meta = std::fs::metadata(&target).ok().filter(|m| m.is_file())?;
            Some(FileHit {
                path: target.to_string_lossy().into_owned(),
                name: target.file_name()?.to_string_lossy().into_owned(),
                size: meta.len(),
                modified: ms(meta.modified().ok()),
            })
        })
        .take(limit)
        .collect();
    if com {
        unsafe { CoUninitialize() };
    }
    out
}

/// Whether Esky listed this file (indexed or recent), so the page can't ask about arbitrary paths.
pub fn is_known(path: &str) -> bool {
    let p = PathBuf::from(path);
    INDEX.lock().unwrap().iter().any(|e| e.path == p) || recent(100).iter().any(|h| h.path.eq_ignore_ascii_case(path))
}

/// The start of a text file, for the preview (None for binary files).
pub fn preview_text(path: &str) -> Option<String> {
    use std::io::Read;
    let mut buf = vec![0u8; 4096];
    let n = std::fs::File::open(path).ok()?.read(&mut buf).ok()?;
    buf.truncate(n);
    if buf.contains(&0) {
        return None;
    }
    Some(String::from_utf8_lossy(&buf).into_owned())
}

/// Windows' "Open with" dialog for the file.
pub fn open_with(path: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("rundll32.exe")
        .arg("shell32.dll,OpenAs_RunDLL")
        .arg(path)
        .creation_flags(0x0800_0000)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

