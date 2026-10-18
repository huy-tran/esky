//! Window Layouts: move or size the app Esky was opened from, through Hyprland.
//! Tiled windows are floated first, since a tiling layout owns their size and place.

use super::util;

struct Area {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

/// A monitor's usable area (bars excluded) in layout coordinates.
fn work_area(m: &serde_json::Value) -> Area {
    let scale = m["scale"].as_f64().filter(|s| *s > 0.0).unwrap_or(1.0);
    let reserved = |i: usize| m["reserved"][i].as_f64().unwrap_or(0.0);
    let (x, y) = (m["x"].as_f64().unwrap_or(0.0), m["y"].as_f64().unwrap_or(0.0));
    Area {
        x: x + reserved(0),
        y: y + reserved(1),
        w: m["width"].as_f64().unwrap_or(0.0) / scale - reserved(0) - reserved(2),
        h: m["height"].as_f64().unwrap_or(0.0) / scale - reserved(1) - reserved(3),
    }
}

/// `layout` is "maximize", "restore", "center", "next-display", or a rectangle in percent of the
/// screen's work area: [left, top, width, height].
pub fn apply(target: isize, layout: &str, rect: Option<[f64; 4]>) -> Result<(), String> {
    let want = util::addr_arg(target);
    let client = util::clients()
        .into_iter()
        .find(|c| c["address"].as_str().and_then(util::parse_addr) == Some(target))
        .ok_or("That window has closed")?;
    let monitors = util::hypr_json(&["monitors"])?;
    let monitors = monitors.as_array().cloned().unwrap_or_default();
    let mon = monitors.iter().find(|m| m["id"] == client["monitor"]).or(monitors.first()).ok_or("No display found")?;
    let area = work_area(mon);
    let fullscreen = client["fullscreen"].as_i64().unwrap_or(0);
    let floating = client["floating"].as_bool().unwrap_or(false);

    // The window-less dispatchers act on the focused window.
    util::hypr_dispatch(&["focuswindow", &want])?;
    match layout {
        "maximize" => {
            if fullscreen == 0 {
                util::hypr_dispatch(&["fullscreen", "1"])?;
            }
        }
        "restore" => {
            if fullscreen != 0 {
                util::hypr_dispatch(&["fullscreen", &fullscreen.to_string()])?;
            } else if floating {
                util::hypr_dispatch(&["settiled", &want])?;
            }
        }
        "center" => {
            if fullscreen != 0 {
                util::hypr_dispatch(&["fullscreen", &fullscreen.to_string()])?;
            }
            if !floating {
                util::hypr_dispatch(&["setfloating", &want])?;
            }
            util::hypr_dispatch(&["centerwindow"])?;
        }
        "next-display" => {
            if monitors.len() < 2 {
                return Err("There's only one display".into());
            }
            util::hypr_dispatch(&["movewindow", "mon:+1"])?;
        }
        "rect" => {
            let [x, y, w, h] = rect.ok_or("No layout given")?;
            if fullscreen != 0 {
                util::hypr_dispatch(&["fullscreen", &fullscreen.to_string()])?;
            }
            if !floating {
                util::hypr_dispatch(&["setfloating", &want])?;
            }
            let px = |p: f64, total: f64| (p / 100.0 * total).round() as i64;
            let (left, top) = (area.x as i64 + px(x, area.w), area.y as i64 + px(y, area.h));
            let (width, height) = (px(w, area.w), px(h, area.h));
            util::hypr_dispatch(&["resizewindowpixel", &format!("exact {width} {height},{want}")])?;
            util::hypr_dispatch(&["movewindowpixel", &format!("exact {left} {top},{want}")])?;
        }
        _ => return Err("Unknown layout".into()),
    }
    Ok(())
}
