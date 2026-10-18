//! Switch Windows: the windows Hyprland has open.

use super::util;

#[derive(serde::Serialize)]
pub struct OpenWindow {
    pub id: isize,
    pub title: String,
    /// The window class ("firefox"): its name, and what the icon is looked up by.
    pub exe: Option<String>,
    pub minimized: bool,
}

/// The open windows, most recently used first. Esky's own are left out.
pub fn list() -> Vec<OpenWindow> {
    let me = std::process::id() as i64;
    util::clients()
        .into_iter()
        .filter(|c| c["mapped"].as_bool().unwrap_or(true) && !c["hidden"].as_bool().unwrap_or(false) && c["pid"].as_i64() != Some(me))
        .filter_map(|c| {
            let id = util::parse_addr(c["address"].as_str()?)?;
            let class = c["class"].as_str().filter(|s| !s.is_empty()).map(String::from);
            let title = c["title"].as_str().filter(|s| !s.is_empty()).map(String::from).or_else(|| class.clone())?;
            Some(OpenWindow { id, title, exe: class, minimized: false })
        })
        .collect()
}

pub fn focus(id: isize) -> Result<(), String> {
    util::hypr_dispatch(&["focuswindow", &util::addr_arg(id)])
}

pub fn close(id: isize) -> Result<(), String> {
    util::hypr_dispatch(&["closewindow", &util::addr_arg(id)])
}
