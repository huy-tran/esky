use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{
    ipc::Channel,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Ask the launcher webview to open (it positions and shows its own window).
fn show_launcher(app: &AppHandle) {
    let _ = app.emit_to("main", "esky://show", ());
}

fn open_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("/settings".into()))
        .title("Esky Settings")
        .inner_size(900.0, 620.0)
        .resizable(false)
        .maximizable(false)
        .center()
        .build();
}

// Extension tokens live in Windows Credential Manager under the "Esky" service.
// `account` is "<extension>.<preference>", e.g. "forge.token".

fn credential(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("Esky", account).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(account: String) -> Result<Option<String>, String> {
    match credential(&account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_set(account: String, value: String) -> Result<(), String> {
    credential(&account)?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_delete(account: String) -> Result<(), String> {
    match credential(&account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// AI chat runs through the user's own Claude Code CLI (their Claude subscription).
// The prompt goes in on stdin, and each stdout line (stream-json) is passed straight to the page.

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Default)]
struct ClaudeRuns(Mutex<HashMap<u32, Child>>);

fn claude_command(args: &[String]) -> Command {
    let mut cmd = Command::new("claude");
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn is_uuid(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    parts.iter().map(|p| p.len()).eq([8, 4, 4, 4, 12])
        && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_hexdigit()))
}

/// The command line for a lean, non-interactive run: no tools, MCP servers, skills or user
/// settings. Built here from checked values only; keep in step with `claudeArgs` in app/utils/claude.ts.
fn claude_args(mode: &str, system: &str, session_id: Option<&str>) -> Result<Vec<String>, String> {
    if mode != "chat" && mode != "quick" {
        return Err("Unknown mode".into());
    }
    let mut args: Vec<String> = [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
    ]
    .map(String::from)
    .to_vec();
    args.push(format!("--system-prompt={system}"));
    args.extend(
        [
            "--tools",
            "",
            "--strict-mcp-config",
            "--mcp-config",
            r#"{"mcpServers":{}}"#,
            "--setting-sources",
            "",
            "--disable-slash-commands",
        ]
        .map(String::from),
    );
    if mode == "quick" {
        args.push("--no-session-persistence".into());
    }
    if let Some(id) = session_id {
        if !is_uuid(id) {
            return Err("Invalid session id".into());
        }
        args.push(format!("--resume={id}"));
    }
    Ok(args)
}

/// Start one Claude Code turn. Output lines arrive on `on_line`; the last one is an `esky_exit` record.
#[tauri::command]
fn claude_run(
    app: AppHandle,
    run_id: u32,
    mode: String,
    system: String,
    session_id: Option<String>,
    prompt: String,
    on_line: Channel<String>,
) -> Result<(), String> {
    let args = claude_args(&mode, &system, session_id.as_deref())?;
    // Its own folder, so Esky's chats don't mix with project sessions.
    let cwd = app.path().home_dir().map_err(|e| e.to_string())?.join(".esky").join("chats");
    std::fs::create_dir_all(&cwd).map_err(|e| e.to_string())?;
    let mut child = claude_command(&args)
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Couldn't start Claude Code: {e}"))?;

    let mut stdin = child.stdin.take().ok_or("Claude Code has no stdin")?;
    let stdout = child.stdout.take().ok_or("Claude Code has no stdout")?;
    let mut stderr = child.stderr.take().ok_or("Claude Code has no stderr")?;
    stdin.write_all(prompt.as_bytes()).map_err(|e| e.to_string())?;
    drop(stdin); // EOF: Claude Code starts answering.

    app.state::<ClaudeRuns>().0.lock().unwrap().insert(run_id, child);

    let errors = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text);
        text
    });
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(l) => {
                    let _ = on_line.send(l);
                }
                Err(_) => break,
            }
        }
        let stderr_text = errors.join().unwrap_or_default();
        let child = app.state::<ClaudeRuns>().0.lock().unwrap().remove(&run_id);
        let code = child.and_then(|mut c| c.wait().ok()).and_then(|s| s.code());
        let _ = on_line.send(serde_json::json!({ "type": "esky_exit", "code": code, "stderr": stderr_text }).to_string());
    });
    Ok(())
}

/// Stop a running turn (Esc, new chat, closing the view).
#[tauri::command]
fn claude_cancel(app: AppHandle, run_id: u32) {
    if let Some(child) = app.state::<ClaudeRuns>().0.lock().unwrap().get_mut(&run_id) {
        let _ = child.kill();
    }
}

#[derive(serde::Serialize)]
struct ExecOutput {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

/// `claude --version` (`what` = "version") or `claude auth status` ("auth"). Nothing else.
#[tauri::command]
fn claude_info(what: String) -> Result<ExecOutput, String> {
    let args: Vec<String> = match what.as_str() {
        "version" => vec!["--version".into()],
        "auth" => vec!["auth".into(), "status".into()],
        _ => return Err("Unknown request".into()),
    };
    let out = claude_command(&args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("Couldn't start Claude Code: {e}"))?;
    Ok(ExecOutput {
        code: out.status.code(),
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
    })
}

// Git: `git status` for every repo in the folders from the Git extension's preferences.

#[derive(serde::Serialize)]
struct RepoStatus {
    /// The configured folder the repo was found in, as typed (e.g. `~\Herd`).
    root: String,
    path: String,
    name: String,
    /// `git status --porcelain=v2 --branch` output; parsed on the page.
    output: String,
    error: Option<String>,
}

fn expand_home(path: &str, home: &std::path::Path) -> std::path::PathBuf {
    match path.strip_prefix('~') {
        Some(rest) => home.join(rest.trim_start_matches(['\\', '/'])),
        None => std::path::PathBuf::from(path),
    }
}

/// Repos in `root`: the folder itself if it is one, otherwise its direct subfolders that are.
fn find_repos(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    if root.join(".git").exists() {
        return vec![root.to_path_buf()];
    }
    let Ok(entries) = std::fs::read_dir(root) else {
        return vec![];
    };
    let mut repos: Vec<_> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir() && p.join(".git").exists())
        .collect();
    repos.sort();
    repos
}

fn git_status_of(path: &std::path::Path) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C")
        .arg(path)
        .args(["status", "--porcelain=v2", "--branch"])
        // Read-only: don't take the index lock other git tools may be holding.
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().map_err(|e| format!("Couldn't run git: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
async fn git_status(app: AppHandle, roots: Vec<String>) -> Result<Vec<RepoStatus>, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let repos: Vec<(String, std::path::PathBuf)> = roots
        .iter()
        .flat_map(|r| find_repos(&expand_home(r, &home)).into_iter().map(move |p| (r.clone(), p)))
        .collect();

    // A few at a time: dozens of git processes at once slow the whole PC down.
    let next = std::sync::atomic::AtomicUsize::new(0);
    let results = Mutex::new(Vec::with_capacity(repos.len()));
    std::thread::scope(|scope| {
        for _ in 0..8 {
            scope.spawn(|| loop {
                let i = next.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let Some((root, path)) = repos.get(i) else { break };
                let status = git_status_of(path);
                let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                results.lock().unwrap().push(RepoStatus {
                    root: root.clone(),
                    path: path.to_string_lossy().into_owned(),
                    name,
                    output: status.clone().unwrap_or_default(),
                    error: status.err(),
                });
            });
        }
    });
    Ok(results.into_inner().unwrap())
}

/// Windows Terminal in `path`, or PowerShell when Windows Terminal isn't installed.
#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    let wt = Command::new("wt.exe").arg("-d").arg(&path).spawn();
    if wt.is_ok() {
        return Ok(());
    }
    Command::new("powershell.exe")
        .arg("-NoExit")
        .current_dir(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Couldn't open a terminal: {e}"))
}

// Installed apps (see apps.rs). The Shell calls are slow-ish, so they run off the main thread.

#[cfg(windows)]
mod apps;

#[cfg(windows)]
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

/// Apps from the last `apps_list` (AppsFolder id -> .exe). Only these can be launched, and
/// "Run as administrator" only ever starts the .exe recorded here, never a path from the page.
#[derive(Default)]
struct KnownApps(Mutex<HashMap<String, Option<String>>>);

#[cfg(windows)]
#[tauri::command]
async fn apps_list(app: AppHandle) -> Result<Vec<apps::App>, String> {
    let list = blocking(apps::list).await??;
    *app.state::<KnownApps>().0.lock().unwrap() = list.iter().map(|a| (a.id.clone(), a.path.clone())).collect();
    Ok(list)
}

#[cfg(windows)]
#[tauri::command]
async fn app_icons(app: AppHandle, ids: Vec<String>) -> Result<HashMap<String, String>, String> {
    let known = app.state::<KnownApps>().0.lock().unwrap().clone();
    let ids: Vec<String> = ids.into_iter().filter(|id| known.contains_key(id)).collect();
    blocking(move || apps::icons(&ids, 64)).await
}

#[cfg(windows)]
#[tauri::command]
async fn app_launch(app: AppHandle, id: String, admin: bool) -> Result<(), String> {
    let path = app.state::<KnownApps>().0.lock().unwrap().get(&id).cloned().ok_or("Unknown app")?;
    blocking(move || {
        if admin {
            apps::launch_admin(path.as_deref().ok_or("This app can't run as administrator")?)
        } else {
            apps::launch(&id)
        }
    })
    .await?
}

// System commands (see system.rs).

#[cfg(windows)]
mod system;

/// Lock, sleep, restart, shut down, sign out or empty the Recycle Bin.
#[cfg(windows)]
#[tauri::command]
async fn system_action(action: String) -> Result<(), String> {
    blocking(move || match action.as_str() {
        "lock" => system::lock(),
        "sleep" => system::sleep(),
        "restart" | "shutdown" | "signout" => system::power(&action),
        "emptyBin" => system::empty_recycle_bin(),
        _ => Err("Unknown action".into()),
    })
    .await?
}

#[cfg(windows)]
#[tauri::command]
async fn recycle_bin_info() -> Result<system::RecycleBin, String> {
    blocking(system::recycle_bin).await?
}

#[cfg(windows)]
#[tauri::command]
async fn removable_drives() -> Result<Vec<system::Drive>, String> {
    blocking(system::removable_drives).await
}

#[cfg(windows)]
#[tauri::command]
async fn eject_drive(letter: String) -> Result<(), String> {
    blocking(move || system::eject(&letter)).await?
}

// The app you were in before Esky opened (see input.rs).

#[cfg(windows)]
mod input;

/// That app's window, kept here so the page can only ever paste into the app you came from.
#[derive(Default)]
struct PasteTarget(Mutex<Option<isize>>);

/// Call just before showing the launcher from a hotkey: remembers the app in front and, if
/// `read_selection`, reads what's selected in it.
#[cfg(windows)]
#[tauri::command]
async fn capture_target(app: AppHandle, read_selection: bool) -> Result<input::Target, String> {
    let (hwnd, target) = blocking(move || input::capture(read_selection)).await?;
    *app.state::<PasteTarget>().0.lock().unwrap() = hwnd;
    Ok(target)
}

/// Forget the remembered app (Esky opened from the tray, where there's nothing to paste into).
#[tauri::command]
fn clear_target(app: AppHandle) {
    *app.state::<PasteTarget>().0.lock().unwrap() = None;
}

/// Paste `text` into the remembered app. Hide the launcher first.
#[cfg(windows)]
#[tauri::command]
async fn paste_to_target(app: AppHandle, text: String) -> Result<(), String> {
    let target = app.state::<PasteTarget>().0.lock().unwrap().ok_or("There's no app to paste into")?;
    blocking(move || input::paste(target, &text)).await?
}

// Clipboard History (see clipboard.rs).

#[cfg(windows)]
mod clipboard;

/// Where copied images are kept, so they can be shown and pasted again.
fn clipboard_images(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("clipboard"))
}

#[cfg(windows)]
#[tauri::command]
fn clipboard_watch(enabled: bool) {
    clipboard::set_watching(enabled);
}

/// Put a history entry back on the clipboard.
#[cfg(windows)]
#[tauri::command]
async fn clipboard_copy(text: Option<String>, image_file: Option<String>, files: Option<Vec<String>>) -> Result<(), String> {
    blocking(move || clipboard::entry_formats(text, image_file, files).map(|f| input::put(&f))).await?
}

/// Paste a history entry into the app Esky was opened from.
#[cfg(windows)]
#[tauri::command]
async fn clipboard_paste(app: AppHandle, text: Option<String>, image_file: Option<String>, files: Option<Vec<String>>) -> Result<(), String> {
    let target = app.state::<PasteTarget>().0.lock().unwrap().ok_or("There's no app to paste into")?;
    blocking(move || input::paste_formats(target, &clipboard::entry_formats(text, image_file, files)?)).await?
}

#[cfg(windows)]
mod ocr;

/// The text in a saved clipboard image (Windows OCR). Only files in Esky's clipboard folder.
#[cfg(windows)]
#[tauri::command]
async fn clipboard_ocr(app: AppHandle, file: String) -> Result<String, String> {
    let dir = clipboard_images(&app)?;
    if std::path::Path::new(&file).parent() != Some(dir.as_path()) {
        return Err("Not a clipboard image".into());
    }
    blocking(move || ocr::read(&file)).await?
}

/// Delete a saved image when its history entry goes. Only files in Esky's clipboard folder.
#[tauri::command]
fn clipboard_forget_image(app: AppHandle, file: String) -> Result<(), String> {
    let dir = clipboard_images(&app)?;
    let path = std::path::PathBuf::from(&file);
    if path.parent() != Some(dir.as_path()) {
        return Err("Not a clipboard image".into());
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

/// Copy text that clipboard history tools (Esky's, Windows' Win+V) shouldn't keep, e.g. a new password.
#[cfg(windows)]
#[tauri::command]
fn copy_private(text: String) {
    clipboard::copy_private(&text);
}

// Snippet expansion (see expand.rs).

#[cfg(windows)]
mod expand;

/// The snippet keywords to expand as you type; an empty list turns expansion off.
#[cfg(windows)]
#[tauri::command]
fn snippet_keywords(keywords: Vec<String>) {
    expand::set_keywords(keywords);
}

/// Replace the keyword just typed (`keyword_chars` characters) with the snippet text.
#[cfg(windows)]
#[tauri::command]
async fn snippet_expand(keyword_chars: usize, text: String) -> Result<(), String> {
    blocking(move || {
        expand::erase(keyword_chars);
        std::thread::sleep(std::time::Duration::from_millis(30));
        input::paste(expand::foreground(), &text)
    })
    .await?
}

/// Delete the keyword just typed, for a snippet that asks for values before it's pasted.
#[cfg(windows)]
#[tauri::command]
async fn snippet_erase(keyword_chars: usize) -> Result<(), String> {
    blocking(move || expand::erase(keyword_chars)).await
}

// Updates (see updates.rs).

mod updates;

/// The newer version on GitHub, or nothing when this is the latest.
#[tauri::command]
async fn update_check(app: AppHandle) -> Result<Option<updates::UpdateInfo>, String> {
    updates::check(&app).await
}

/// Install the update found by update_check and restart.
#[tauri::command]
async fn update_install(app: AppHandle) -> Result<(), String> {
    updates::install(&app).await
}

/// Write a settings backup to Downloads as "Esky settings <date>.json" and return its path.
#[tauri::command]
fn save_backup(app: AppHandle, json: String) -> Result<String, String> {
    let parsed: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if parsed["app"] != "esky" {
        return Err("Not an Esky backup".into());
    }
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let date = parsed["exported"].as_str().unwrap_or("").get(..10).unwrap_or("backup").replace(|c: char| !c.is_ascii_alphanumeric() && c != '-', "");
    let mut path = dir.join(format!("Esky settings {date}.json"));
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("Esky settings {date} ({n}).json"));
        n += 1;
    }
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

// Switch Windows (see switcher.rs).

#[cfg(windows)]
mod switcher;

/// The open app windows, most recently used first.
#[cfg(windows)]
#[tauri::command]
async fn windows_list() -> Result<Vec<switcher::OpenWindow>, String> {
    blocking(switcher::list).await
}

/// Icons for programs (.exe paths), as PNG data URLs. Programs without one are left out.
#[cfg(windows)]
#[tauri::command]
async fn exe_icons(paths: Vec<String>) -> Result<HashMap<String, String>, String> {
    blocking(move || {
        paths
            .into_iter()
            .filter(|p| p.to_lowercase().ends_with(".exe") && std::path::Path::new(p).is_file())
            .filter_map(|p| apps::shell_image_once(&p, 32, true).ok().map(|i| (p, i)))
            .collect()
    })
    .await
}

#[cfg(windows)]
#[tauri::command]
async fn window_focus(id: isize) -> Result<(), String> {
    blocking(move || switcher::focus(id)).await?
}

#[cfg(windows)]
#[tauri::command]
async fn window_close(id: isize) -> Result<(), String> {
    blocking(move || switcher::close(id)).await?
}

// Window Layouts (see window.rs).

#[cfg(windows)]
mod window;

/// Move or size the app Esky was opened from.
#[cfg(windows)]
#[tauri::command]
async fn window_layout(app: AppHandle, layout: String, rect: Option<[f64; 4]>) -> Result<(), String> {
    let target = app.state::<PasteTarget>().0.lock().unwrap().ok_or("Open Esky from another app first: there's no window to arrange")?;
    blocking(move || window::apply(target, &layout, rect)).await?
}

// File Search (see files.rs).

#[cfg(windows)]
mod files;

/// Index the folders from the File Search preferences. Returns how many files were found.
#[cfg(windows)]
#[tauri::command]
async fn files_index(app: AppHandle, folders: Vec<String>) -> Result<usize, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let roots: Vec<_> = folders.iter().map(|f| expand_home(f, &home)).collect();
    blocking(move || files::rebuild(&roots)).await
}

#[cfg(windows)]
#[tauri::command]
async fn files_search(query: String) -> Result<Vec<files::FileHit>, String> {
    blocking(move || files::search(&query, 60)).await
}

#[cfg(windows)]
#[tauri::command]
async fn files_recent() -> Result<Vec<files::FileHit>, String> {
    blocking(|| files::recent(30)).await
}

#[derive(serde::Serialize)]
struct FilePreview {
    text: Option<String>,
    image: Option<String>,
}

/// The start of a text file, or a thumbnail (photos, PDFs) or icon for anything else.
#[cfg(windows)]
#[tauri::command]
async fn file_preview(path: String) -> Result<FilePreview, String> {
    blocking(move || {
        if !files::is_known(&path) {
            return Err("Not a file Esky listed".to_string());
        }
        let text = files::preview_text(&path);
        let image = if text.is_none() { apps::shell_image_once(&path, 256, false).ok() } else { None };
        Ok(FilePreview { text, image })
    })
    .await?
}

#[cfg(windows)]
#[tauri::command]
async fn file_open_with(path: String) -> Result<(), String> {
    blocking(move || {
        if !files::is_known(&path) {
            return Err("Not a file Esky listed".to_string());
        }
        files::open_with(&path)
    })
    .await?
}

// Media Controls (see media.rs).

#[cfg(windows)]
mod media;

#[cfg(windows)]
#[tauri::command]
async fn media_control(action: String, spotify_only: bool) -> Result<media::NowPlaying, String> {
    blocking(move || media::control(&action, spotify_only)).await?
}

// Docker (see docker.rs).

#[cfg(windows)]
mod docker;

#[cfg(windows)]
#[tauri::command]
async fn docker_list(kind: String, host: String) -> Result<Vec<serde_json::Value>, String> {
    blocking(move || docker::list(&kind, &host)).await?
}

#[cfg(windows)]
#[tauri::command]
async fn docker_action(kind: String, action: String, id: String, host: String) -> Result<(), String> {
    blocking(move || {
        if action == "logs" {
            docker::logs(&id)
        } else {
            docker::action(&kind, &action, &id, &host)
        }
    })
    .await?
}

// Colour Picker (see colour.rs).

#[cfg(windows)]
mod colour;

/// Pick a colour from anywhere on screen. Hide the launcher first. None if cancelled.
#[cfg(windows)]
#[tauri::command]
async fn colour_pick() -> Result<Option<colour::Picked>, String> {
    // Its own thread: the hooks need a message loop and must not block other commands.
    tauri::async_runtime::spawn_blocking(colour::pick).await.map_err(|e| e.to_string())
}

// AI with an Anthropic API key (see anthropic.rs).

mod anthropic;

#[derive(Default)]
struct ApiRuns(Mutex<HashMap<u32, std::sync::Arc<std::sync::atomic::AtomicBool>>>);

/// Stream one reply from the Messages API. Events arrive on `on_event`, the same shape as Claude Code's.
#[tauri::command]
fn anthropic_run(app: AppHandle, run_id: u32, model: String, system: String, messages: Vec<anthropic::Message>, quick: bool, on_event: Channel<String>) {
    let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    app.state::<ApiRuns>().0.lock().unwrap().insert(run_id, flag.clone());
    std::thread::spawn(move || {
        anthropic::run(&model, &system, messages, quick, flag, on_event);
        app.state::<ApiRuns>().0.lock().unwrap().remove(&run_id);
    });
}

#[tauri::command]
fn anthropic_cancel(app: AppHandle, run_id: u32) {
    if let Some(f) = app.state::<ApiRuns>().0.lock().unwrap().get(&run_id) {
        f.store(true, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Is an API key saved? (The key itself never leaves Rust.)
#[tauri::command]
fn anthropic_has_key() -> bool {
    anthropic::has_key()
}

// Web services for extensions (see api.rs).

mod api;

/// Call Forge, GitHub, Jira or Sentry with the token saved for that extension.
#[tauri::command]
async fn ext_api(ext: String, method: String, url: String, body: Option<serde_json::Value>, user: Option<String>) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || api::request(&ext, &method, &url, body, user)).await.map_err(|e| e.to_string())?
}

/// `ssh user@host -p port` in Windows Terminal (or PowerShell).
#[tauri::command]
fn open_ssh(user: String, host: String, port: u16) -> Result<(), String> {
    let ok = |s: &str| !s.is_empty() && !s.starts_with('-') && s.chars().all(|c| c.is_ascii_alphanumeric() || ".-_:".contains(c));
    if !ok(&user) || !ok(&host) {
        return Err("Not a server address".into());
    }
    let target = format!("{user}@{host}");
    let port = port.to_string();
    if Command::new("wt.exe").args(["new-tab", "--title", &host, "ssh", "-p", &port, &target]).spawn().is_ok() {
        return Ok(());
    }
    Command::new("powershell.exe")
        .args(["-NoExit", "-Command", "ssh", "-p", &port, &target])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_launcher(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ClaudeRuns::default())
        .manage(ApiRuns::default())
        .manage(updates::Pending::default())
        .manage(KnownApps::default())
        .manage(PasteTarget::default())
        .invoke_handler(tauri::generate_handler![
            secret_get,
            secret_set,
            secret_delete,
            claude_run,
            claude_cancel,
            anthropic_run,
            anthropic_cancel,
            anthropic_has_key,
            claude_info,
            git_status,
            open_terminal,
            apps_list,
            app_icons,
            app_launch,
            system_action,
            recycle_bin_info,
            removable_drives,
            eject_drive,
            capture_target,
            clear_target,
            paste_to_target,
            clipboard_watch,
            clipboard_copy,
            clipboard_paste,
            clipboard_forget_image,
            clipboard_ocr,
            copy_private,
            snippet_keywords,
            snippet_expand,
            snippet_erase,
            window_layout,
            windows_list,
            save_backup,
            update_check,
            update_install,
            exe_icons,
            window_focus,
            window_close,
            files_index,
            files_search,
            files_recent,
            file_preview,
            file_open_with,
            media_control,
            docker_list,
            docker_action,
            colour_pick,
            ext_api,
            open_ssh
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("launcher window is defined in tauri.conf.json");

            // Clipboard History records once the page turns it on (it knows the setting).
            #[cfg(windows)]
            clipboard::start(app.handle().clone(), clipboard_images(app.handle())?);
            // Snippet expansion waits for keywords from the page (none until it sends them).
            #[cfg(windows)]
            expand::start(app.handle().clone());

            // Mica on Windows 11, Acrylic on Windows 10. The page falls back to --win-bg.
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::{apply_acrylic, apply_mica};
                if apply_mica(&window, Some(true)).is_err() {
                    let _ = apply_acrylic(&window, Some((15, 23, 42, 200)));
                }
            }

            let open = MenuItem::with_id(app, "open", "Open Esky", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Esky", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &settings, &quit])?;

            TrayIconBuilder::with_id("esky")
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Esky")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_launcher(app),
                    "settings" => open_settings(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_launcher(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Alt+F4 on the launcher hides it instead of quitting; Esky lives in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Esky");
}
