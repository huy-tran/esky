//! Installed apps from the .desktop files every launcher reads, and their icons.

use super::util;
use base64::Engine;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(serde::Serialize)]
pub struct App {
    /// The desktop file's name, e.g. "firefox.desktop".
    pub id: String,
    pub name: String,
    /// Always none here: the .desktop file isn't a program, so "Run as administrator" and "Reveal" stay off.
    pub path: Option<String>,
}

struct Entry {
    file: PathBuf,
    icon: Option<String>,
    /// StartupWMClass, lowercased: what a window of this app calls itself.
    wm_class: Option<String>,
    name: String,
}

static ENTRIES: Mutex<Vec<(String, Entry)>> = Mutex::new(Vec::new());

fn data_dirs() -> Vec<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default();
    let mut dirs = vec![std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local/share"))];
    let system = std::env::var("XDG_DATA_DIRS").ok().filter(|d| !d.is_empty()).unwrap_or_else(|| "/usr/local/share:/usr/share".into());
    dirs.extend(system.split(':').filter(|d| !d.is_empty()).map(PathBuf::from));
    dirs.push(home.join(".local/share/flatpak/exports/share"));
    dirs.push(PathBuf::from("/var/lib/flatpak/exports/share"));
    dirs
}

/// The `[Desktop Entry]` keys of a file, without the translated ones (`Name[fr]`).
fn parse(file: &Path) -> Option<HashMap<String, String>> {
    let text = std::fs::read_to_string(file).ok()?;
    let mut keys = HashMap::new();
    let mut inside = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            inside = line == "[Desktop Entry]";
        } else if inside && !line.starts_with('#') {
            if let Some((k, v)) = line.split_once('=') {
                if !k.contains('[') {
                    keys.entry(k.trim().to_string()).or_insert_with(|| v.trim().to_string());
                }
            }
        }
    }
    Some(keys)
}

fn scan() -> Vec<(String, Entry)> {
    let mut found: Vec<(String, Entry)> = Vec::new();
    for dir in data_dirs() {
        let Ok(read) = std::fs::read_dir(dir.join("applications")) else { continue };
        for e in read.flatten() {
            let file = e.path();
            let Some(id) = file.file_name().map(|n| n.to_string_lossy().into_owned()).filter(|n| n.ends_with(".desktop")) else { continue };
            // The first directory with an id wins, as in the spec: the user's own files override the system's.
            if found.iter().any(|(i, _)| *i == id) {
                continue;
            }
            let Some(k) = parse(&file) else { continue };
            let hidden = |key: &str| k.get(key).is_some_and(|v| v == "true");
            if k.get("Type").map(String::as_str) != Some("Application") || hidden("NoDisplay") || hidden("Hidden") {
                continue;
            }
            let Some(name) = k.get("Name").filter(|n| !n.is_empty()).cloned() else { continue };
            found.push((id, Entry { file, icon: k.get("Icon").cloned(), wm_class: k.get("StartupWMClass").map(|c| c.to_lowercase()), name }));
        }
    }
    found.sort_by_key(|(_, e)| e.name.to_lowercase());
    found
}

pub fn list() -> Result<Vec<App>, String> {
    let found = scan();
    let apps = found.iter().map(|(id, e)| App { id: id.clone(), name: e.name.clone(), path: None }).collect();
    *ENTRIES.lock().unwrap() = found;
    Ok(apps)
}

/// Open an app. `gio launch` handles the Exec line's field codes the way a launcher should.
pub fn launch(id: &str) -> Result<(), String> {
    let file = ENTRIES.lock().unwrap().iter().find(|(i, _)| i == id).map(|(_, e)| e.file.clone()).ok_or("Unknown app")?;
    let path = file.to_string_lossy().into_owned();
    if util::find("gio").is_some() {
        return util::spawn("gio", &["launch", &path], None);
    }
    util::spawn("gtk-launch", &[id.trim_end_matches(".desktop")], None)
}

pub fn launch_admin(_path: &str) -> Result<(), String> {
    Err("Running as administrator isn't available on Linux".into())
}

/// The icon file for a theme icon name (or an absolute path).
fn find_icon(name: &str) -> Option<PathBuf> {
    if name.starts_with('/') {
        return Path::new(name).is_file().then(|| PathBuf::from(name));
    }
    let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default();
    let mut bases: Vec<PathBuf> = data_dirs().into_iter().map(|d| d.join("icons")).collect();
    bases.push(home.join(".icons"));
    const SIZES: [&str; 8] = ["64x64", "128x128", "96x96", "48x48", "256x256", "scalable", "512x512", "32x32"];
    for base in &bases {
        let Ok(themes) = std::fs::read_dir(base) else { continue };
        for theme in themes.flatten() {
            for size in SIZES {
                for ext in ["png", "svg"] {
                    for layout in [format!("{size}/apps"), format!("apps/{size}")] {
                        let p = theme.path().join(layout).join(format!("{name}.{ext}"));
                        if p.is_file() {
                            return Some(p);
                        }
                    }
                }
            }
        }
    }
    ["png", "svg"].iter().map(|ext| PathBuf::from(format!("/usr/share/pixmaps/{name}.{ext}"))).find(|p| p.is_file())
}

fn data_url(file: &Path) -> Option<String> {
    let mime = match file.extension()?.to_str()? {
        "png" => "image/png",
        "svg" => "image/svg+xml",
        _ => return None,
    };
    let bytes = std::fs::read(file).ok().filter(|b| b.len() < 400_000)?;
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

pub fn icons(ids: &[String], _size: i32) -> HashMap<String, String> {
    let wanted: Vec<(String, String)> = {
        let entries = ENTRIES.lock().unwrap();
        ids.iter().filter_map(|id| entries.iter().find(|(i, _)| i == id).and_then(|(_, e)| e.icon.clone()).map(|icon| (id.clone(), icon))).collect()
    };
    wanted.into_iter().filter_map(|(id, icon)| data_url(&find_icon(&icon)?).map(|u| (id, u))).collect()
}

/// The entry for a window class ("firefox", "org.gnome.Nautilus"): by StartupWMClass, else by file name.
fn entry_for_class<'a>(entries: &'a [(String, Entry)], class: &str) -> Option<&'a Entry> {
    let class = class.to_lowercase();
    entries
        .iter()
        .find(|(_, e)| e.wm_class.as_deref() == Some(class.as_str()))
        .or_else(|| entries.iter().find(|(id, _)| id.trim_end_matches(".desktop").to_lowercase() == class))
        .map(|(_, e)| e)
}

fn ensure_loaded() {
    if ENTRIES.lock().unwrap().is_empty() {
        let _ = list();
    }
}

/// The app's own name for a window class, e.g. "Visual Studio Code" for "code".
pub fn name_for_class(class: &str) -> Option<String> {
    ensure_loaded();
    entry_for_class(&ENTRIES.lock().unwrap(), class).map(|e| e.name.clone())
}

/// Icons for window classes, as data URLs. Classes without a desktop file or icon are left out.
pub fn class_icons(classes: &[String]) -> HashMap<String, String> {
    ensure_loaded();
    let wanted: Vec<(String, String)> = {
        let entries = ENTRIES.lock().unwrap();
        classes.iter().filter_map(|c| entry_for_class(&entries, c).and_then(|e| e.icon.clone()).map(|i| (c.clone(), i))).collect()
    };
    wanted.into_iter().filter_map(|(c, icon)| data_url(&find_icon(&icon)?).map(|u| (c, u))).collect()
}

/// File thumbnails come from Windows' shell; there is no equivalent here, so previews show text only.
pub fn shell_image_once(_path: &str, _size: i32, _icon_only: bool) -> Result<String, String> {
    Err("No thumbnails on Linux".into())
}
