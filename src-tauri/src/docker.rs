//! Docker: list containers, Compose projects and images, and start/stop/remove them, through the
//! `docker` command-line tool (Docker Desktop installs it).

use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const DEFAULT_HOST: &str = "npipe:////./pipe/docker_engine";

fn docker(host: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("docker");
    cmd.args(args).creation_flags(CREATE_NO_WINDOW);
    if !host.is_empty() && host != DEFAULT_HOST {
        cmd.env("DOCKER_HOST", host);
    }
    let out = cmd.output().map_err(|_| "Docker isn't installed (the docker command wasn't found)".to_string())?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
    }
    let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if msg.contains("pipe") || msg.contains("daemon") { "Docker isn't running. Start Docker Desktop first.".into() } else { msg })
}

/// Container, project and image names/ids only: never anything Docker could read as an option.
fn valid(id: &str) -> bool {
    !id.is_empty() && id.len() < 256 && !id.starts_with('-') && id.chars().all(|c| c.is_ascii_alphanumeric() || "_.:/@-".contains(c))
}

/// "containers", "compose" or "images", as JSON objects straight from Docker.
pub fn list(kind: &str, host: &str) -> Result<Vec<serde_json::Value>, String> {
    match kind {
        "containers" => lines(&docker(host, &["ps", "-a", "--no-trunc", "--format", "{{json .}}"])?),
        "images" => lines(&docker(host, &["images", "--format", "{{json .}}"])?),
        "compose" => serde_json::from_str(docker(host, &["compose", "ls", "-a", "--format", "json"])?.trim()).map_err(|e| e.to_string()),
        _ => Err("Unknown list".into()),
    }
}

fn lines(out: &str) -> Result<Vec<serde_json::Value>, String> {
    out.lines().filter(|l| !l.trim().is_empty()).map(|l| serde_json::from_str(l).map_err(|e| e.to_string())).collect()
}

/// Start, stop, restart or remove a container, project or image.
pub fn action(kind: &str, action: &str, id: &str, host: &str) -> Result<(), String> {
    if !valid(id) {
        return Err("Not a Docker name".into());
    }
    let args: Vec<&str> = match (kind, action) {
        ("containers", "start" | "stop" | "restart") => vec![action, id],
        ("containers", "remove") => vec!["rm", "-f", id],
        ("compose", "start" | "stop" | "restart") => vec!["compose", "-p", id, action],
        ("images", "remove") => vec!["rmi", id],
        _ => return Err("Unknown action".into()),
    };
    docker(host, &args).map(|_| ())
}

/// Follow a container's logs in Windows Terminal (or PowerShell).
pub fn logs(id: &str) -> Result<(), String> {
    if !valid(id) {
        return Err("Not a Docker name".into());
    }
    let wt = Command::new("wt.exe").args(["new-tab", "--title", id, "docker", "logs", "-f", "--tail", "200", id]).spawn();
    if wt.is_ok() {
        return Ok(());
    }
    Command::new("powershell.exe")
        .args(["-NoExit", "-Command", "docker", "logs", "-f", "--tail", "200", id])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
