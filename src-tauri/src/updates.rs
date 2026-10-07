//! Updates: check this repo's latest GitHub release and install it in place (Tauri updater).
//! Releases are signed by the release workflow; the updater checks that signature against the
//! public key in tauri.conf.json before installing anything.

use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, ready to install.
#[derive(Default)]
pub struct Pending(pub Mutex<Option<Update>>);

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Option<String>,
}

/// The repo (owner/name) this build was released from, set by the release workflow.
fn repo() -> Option<&'static str> {
    option_env!("ESKY_UPDATE_REPO").filter(|r| !r.is_empty())
}

pub async fn check(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let repo = repo().ok_or("Updates are off in this build")?;
    let url = tauri::Url::parse(&format!("https://github.com/{repo}/releases/latest/download/latest.json")).map_err(|e| e.to_string())?;
    let updater = app.updater_builder().endpoints(vec![url]).map_err(|e| e.to_string())?.build().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| format!("Couldn't check for updates: {e}"))?;
    let info = found.as_ref().map(|u| UpdateInfo { version: u.version.clone(), notes: u.body.clone() });
    *app.state::<Pending>().0.lock().unwrap() = found;
    Ok(info)
}

/// Download, verify and install the update found by `check`, then restart Esky.
pub async fn install(app: &AppHandle) -> Result<(), String> {
    let update = app.state::<Pending>().0.lock().unwrap().take().ok_or("Check for updates first")?;
    update.download_and_install(|_, _| {}, || {}).await.map_err(|e| format!("Couldn't install the update: {e}"))?;
    app.restart();
}
