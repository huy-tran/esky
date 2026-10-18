//! Linux (built for Omarchy: Arch with Hyprland, on Wayland). Each module here stands in for the
//! Windows module of the same name and keeps its API, so lib.rs reads the same on both.
//! Everything shells out to tools Omarchy ships (hyprctl, wl-clipboard, playerctl, ...); a missing
//! tool is an error message for that one feature, never a crash.

pub mod apps;
pub mod clipboard;
pub mod colour;
pub mod expand;
pub mod input;
pub mod media;
pub mod ocr;
pub mod switcher;
pub mod system;
pub mod terminal;
pub mod util;
pub mod window;
