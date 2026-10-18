//! Colour Picker: `hyprpicker` lets you click any pixel on screen.

use super::util;

#[derive(serde::Serialize, Clone, Copy)]
pub struct Picked {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// Pick a colour from anywhere on screen. None if cancelled (or hyprpicker isn't installed).
pub fn pick() -> Option<Picked> {
    let out = util::run("hyprpicker", &["--no-fancy"]).ok()?;
    let hex = out.trim().trim_start_matches('#');
    if hex.len() < 6 {
        return None;
    }
    let byte = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).ok();
    Some(Picked { r: byte(0)?, g: byte(2)?, b: byte(4)? })
}
