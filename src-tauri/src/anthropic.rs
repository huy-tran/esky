//! AI Chat and Quick AI with an Anthropic API key (Settings → AI). The key stays in Windows
//! Credential Manager ("Esky" / "anthropic.key") and never reaches the page. Replies stream back
//! as the same events the Claude Code backend sends: text, done and error.

use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;

pub const MODELS: [&str; 3] = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"];

#[derive(serde::Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

fn key() -> Result<String, String> {
    keyring::Entry::new("Esky", "anthropic.key")
        .ok()
        .and_then(|e| e.get_password().ok())
        .filter(|k| !k.trim().is_empty())
        .ok_or_else(|| "Add your Anthropic API key in Settings → AI".to_string())
}

pub fn has_key() -> bool {
    key().is_ok()
}

fn send(ch: &Channel<String>, v: serde_json::Value) {
    let _ = ch.send(v.to_string());
}

fn error(ch: &Channel<String>, message: impl Into<String>) {
    send(ch, serde_json::json!({ "type": "error", "message": message.into() }));
}

/// Stream one reply. `quick` runs answer with less thinking and a smaller limit.
pub fn run(model: &str, system: &str, messages: Vec<Message>, quick: bool, cancelled: Arc<AtomicBool>, ch: Channel<String>) {
    if let Err(e) = stream(model, system, messages, quick, &cancelled, &ch) {
        if !cancelled.load(Ordering::Relaxed) {
            error(&ch, e);
        }
    }
}

fn stream(model: &str, system: &str, messages: Vec<Message>, quick: bool, cancelled: &AtomicBool, ch: &Channel<String>) -> Result<(), String> {
    if !MODELS.contains(&model) {
        return Err("Unknown model".into());
    }
    let key = key()?;
    let messages: Vec<_> = messages
        .into_iter()
        .filter(|m| (m.role == "user" || m.role == "assistant") && !m.content.trim().is_empty())
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": if quick { 8000 } else { 32000 },
        "system": system,
        "messages": messages,
        "stream": true,
    });
    let haiku = model.starts_with("claude-haiku");
    if !haiku {
        // A declined request is retried on another model server-side instead of failing.
        body["fallbacks"] = "default".into();
        if quick {
            body["output_config"] = serde_json::json!({ "effort": "low" });
        }
    }

    let agent = ureq::Agent::config_builder().http_status_as_error(false).build().new_agent();
    let mut req = agent
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json");
    if !haiku {
        req = req.header("anthropic-beta", "server-side-fallback-2026-07-01");
    }
    let res = req.send(body.to_string()).map_err(|e| format!("Couldn't reach the Anthropic API: {e}"))?;
    let status = res.status().as_u16();
    let mut body = res.into_body();
    if status >= 400 {
        let text = body.read_to_string().unwrap_or_default();
        let detail = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|j| j["error"]["message"].as_str().map(String::from));
        return Err(match status {
            401 => "The API key was rejected. Check it in Settings → AI.".into(),
            429 => "Rate limited by the Anthropic API. Try again in a minute.".into(),
            529 => "The Anthropic API is overloaded. Try again shortly.".into(),
            _ => detail.unwrap_or_else(|| format!("The Anthropic API answered {status}")),
        });
    }

    let mut text = String::new();
    let mut stop = String::new();
    for line in BufReader::new(body.into_reader()).lines() {
        if cancelled.load(Ordering::Relaxed) {
            return Ok(());
        }
        let line = line.map_err(|e| format!("The reply was cut off: {e}"))?;
        let Some(data) = line.strip_prefix("data:") else { continue };
        let Ok(ev) = serde_json::from_str::<serde_json::Value>(data.trim()) else { continue };
        match ev["type"].as_str() {
            Some("content_block_delta") if ev["delta"]["type"] == "text_delta" => {
                if let Some(t) = ev["delta"]["text"].as_str() {
                    text.push_str(t);
                    send(ch, serde_json::json!({ "type": "text", "text": t }));
                }
            }
            Some("message_delta") => {
                if let Some(s) = ev["delta"]["stop_reason"].as_str() {
                    stop = s.to_string();
                }
            }
            Some("error") => {
                return Err(ev["error"]["message"].as_str().unwrap_or("The Anthropic API returned an error").to_string());
            }
            Some("message_stop") => break,
            _ => {}
        }
    }
    if stop == "refusal" {
        return Err("Claude declined this request.".into());
    }
    send(ch, serde_json::json!({ "type": "done", "text": text }));
    Ok(())
}
