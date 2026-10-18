//! Clipboard History: notices each copy (text, images, files), saves images to disk, and tells the
//! page. Also puts history entries back on the clipboard for pasting. Uses wl-clipboard.

use super::input::{self, Snapshot};
use super::util;
use base64::Engine;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

/// Off until the page turns it on (Settings → Clipboard → Clipboard history).
static WATCHING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Copied {
    pub kind: &'static str, // "text" | "image" | "files"
    pub text: Option<String>,
    pub files: Option<Vec<String>>,
    /// Saved PNG for images, and a small preview of it.
    pub image_file: Option<String>,
    pub thumb: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub bytes: Option<u64>,
    pub app_path: Option<String>,
    /// Marked "don't record" by the app that copied it (password managers do this).
    pub sensitive: bool,
}

pub fn set_watching(on: bool) {
    WATCHING.store(on, Ordering::Relaxed);
}

fn decode_percent(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() && s.is_char_boundary(i + 1) && s.is_char_boundary(i + 3) {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn encode_png(w: u32, h: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut enc = png::Encoder::new(&mut out, w, h);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header().ok()?;
    writer.write_image_data(rgba).ok()?;
    drop(writer);
    Some(out)
}

/// A PNG's size, and a preview no bigger than `max` pixels on its longest side.
fn size_and_thumb(png_bytes: &[u8], max: u32) -> Option<(u32, u32, Vec<u8>)> {
    let mut reader = png::Decoder::new(std::io::Cursor::new(png_bytes)).read_info().ok()?;
    let mut buf = vec![0; reader.output_buffer_size()?];
    let info = reader.next_frame(&mut buf).ok()?;
    let (w, h) = (info.width, info.height);
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
        png::ColorType::Rgb => buf[..info.buffer_size()].chunks_exact(3).flat_map(|p| [p[0], p[1], p[2], 255]).collect(),
        _ => return None,
    };
    let scale = (max as f32 / w.max(h) as f32).min(1.0);
    let (tw, th) = (((w as f32 * scale) as u32).max(1), ((h as f32 * scale) as u32).max(1));
    let mut out = vec![0u8; (tw * th * 4) as usize];
    for y in 0..th {
        for x in 0..tw {
            let (sx, sy) = ((x as f32 / scale) as u32, (y as f32 / scale) as u32);
            let s = ((sy.min(h - 1) * w + sx.min(w - 1)) * 4) as usize;
            let d = ((y * tw + x) * 4) as usize;
            out[d..d + 4].copy_from_slice(&rgba[s..s + 4]);
        }
    }
    Some((w, h, encode_png(tw, th, &out)?))
}

/// What's on the clipboard now, or None when it's nothing Esky records.
fn read(images: &Path) -> Option<Copied> {
    let types = util::run("wl-paste", &["--list-types"]).ok()?;
    let types: Vec<&str> = types.lines().collect();
    let mut c = Copied { kind: "text", text: None, files: None, image_file: None, thumb: None, width: None, height: None, bytes: None, app_path: None, sensitive: false };
    // Password managers mark their copies with this type.
    if types.iter().any(|t| t.eq_ignore_ascii_case("x-kde-passwordManagerHint")) {
        c.sensitive = true;
        return Some(c);
    }
    if types.contains(&"text/uri-list") {
        let list = util::run("wl-paste", &["--no-newline", "--type", "text/uri-list"]).ok()?;
        let files: Vec<String> = list.lines().filter_map(|l| l.strip_prefix("file://")).map(decode_percent).collect();
        if !files.is_empty() {
            c.kind = "files";
            c.files = Some(files);
            return Some(c);
        }
    }
    if let Some(t) = ["text/plain;charset=utf-8", "text/plain", "UTF8_STRING"].into_iter().find(|t| types.contains(t)) {
        c.text = util::run("wl-paste", &["--no-newline", "--type", t]).ok().filter(|t| !t.trim().is_empty());
        return c.text.is_some().then_some(c);
    }
    if types.contains(&"image/png") {
        let bytes = util::run_bytes("wl-paste", &["--type", "image/png"]).ok()?;
        let (w, h, thumb) = size_and_thumb(&bytes, 360)?;
        std::fs::create_dir_all(images).ok()?;
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis());
        let file = images.join(format!("{stamp}-{}.png", std::process::id()));
        std::fs::write(&file, &bytes).ok()?;
        c.kind = "image";
        c.bytes = Some(bytes.len() as u64);
        c.image_file = Some(file.to_string_lossy().into_owned());
        c.thumb = Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(thumb)));
        (c.width, c.height) = (Some(w), Some(h));
        return Some(c);
    }
    None
}

/// Watch for copies with `wl-paste --watch` (one line per change) and emit `clipboard://copied`.
pub fn start(app: AppHandle, images: PathBuf) {
    std::thread::spawn(move || {
        let Ok(mut child) = Command::new("wl-paste").args(["--watch", "echo"]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn() else {
            return; // No wl-clipboard: Clipboard History stays empty.
        };
        let Some(out) = child.stdout.take() else { return };
        for _ in BufReader::new(out).lines() {
            if !WATCHING.load(Ordering::Relaxed) || input::is_quiet() {
                continue;
            }
            if let Some(c) = read(&images) {
                let _ = app.emit("clipboard://copied", c);
            }
        }
    });
}

/// A history entry as clipboard formats: text, an image file, or a list of files.
pub fn entry_formats(text: Option<String>, image_file: Option<String>, files: Option<Vec<String>>) -> Result<Snapshot, String> {
    if let Some(f) = image_file {
        let bytes = std::fs::read(f).map_err(|_| "That image is no longer saved")?;
        return Ok(vec![("image/png".to_string(), bytes)]);
    }
    if let Some(fs) = files {
        let list: String = fs.iter().map(|f| format!("file://{f}\r\n")).collect();
        return Ok(vec![("text/uri-list".to_string(), list.into_bytes())]);
    }
    Ok(vec![("text/plain;charset=utf-8".to_string(), text.unwrap_or_default().into_bytes())])
}

/// Text on the clipboard that Esky's own history doesn't record. (Other clipboard managers may.)
pub fn copy_private(text: &str) {
    input::quiet_for(1500);
    input::put(&vec![("text/plain;charset=utf-8".to_string(), text.as_bytes().to_vec())]);
}
