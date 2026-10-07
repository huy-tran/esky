//! Calls to the web services extensions use (Forge, GitHub, Jira, Sentry), made from Rust so the
//! tokens stay in Windows Credential Manager and never reach the page. Each service can only call
//! its own address.

use base64::Engine;

fn token(account: &str) -> Option<String> {
    keyring::Entry::new("Esky", account).ok()?.get_password().ok().filter(|t| !t.trim().is_empty())
}

/// The address an extension may call, checked before any token is attached.
fn allowed(ext: &str, url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let host = rest.split('/').next().unwrap_or("");
    let path = &rest[host.len()..];
    let sub_of = |domain: &str| host.ends_with(domain) && host[..host.len() - domain.len()].chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.');
    match ext {
        "forge" => host == "forge.laravel.com" && path.starts_with("/api/"),
        "github" => host == "api.github.com",
        "jira" => sub_of(".atlassian.net") && path.starts_with("/rest/"),
        "sentry" => (host == "sentry.io" || sub_of(".sentry.io")) && path.starts_with("/api/0/"),
        _ => false,
    }
}

/// `method` "GET" or "POST"; `user` is the Jira account email (Jira uses email + token).
pub fn request(ext: &str, method: &str, url: &str, body: Option<serde_json::Value>, user: Option<String>) -> Result<serde_json::Value, String> {
    if !allowed(ext, url) {
        return Err("That address isn't allowed for this extension".into());
    }
    let tok = token(&format!("{ext}.token"));
    let auth = match (ext, tok) {
        ("jira", Some(t)) => {
            let email = user.filter(|u| !u.is_empty()).ok_or("Add your Jira email in Settings → Extensions → Jira")?;
            Some(format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(format!("{email}:{t}"))))
        }
        ("github", None) => None, // public data works without a token
        (_, Some(t)) => Some(format!("Bearer {t}")),
        (_, None) => return Err(format!("Add your {ext} token in Settings → Extensions")),
    };
    let accept = if ext == "github" { "application/vnd.github+json" } else { "application/json" };
    let agent = ureq::Agent::config_builder().http_status_as_error(false).build().new_agent();
    let mut res = match method {
        "GET" => {
            let mut r = agent.get(url).header("Accept", accept).header("User-Agent", "Esky");
            if let Some(a) = &auth {
                r = r.header("Authorization", a);
            }
            r.call()
        }
        "POST" => {
            let mut r = agent.post(url).header("Accept", accept).header("User-Agent", "Esky").header("Content-Type", "application/json");
            if let Some(a) = &auth {
                r = r.header("Authorization", a);
            }
            r.send(body.unwrap_or(serde_json::json!({})).to_string())
        }
        _ => return Err("Unknown method".into()),
    }
    .map_err(|e| format!("Couldn't reach {ext}: {e}"))?;
    let status = res.status().as_u16();
    let text = res.body_mut().read_to_string().unwrap_or_default();
    if status >= 400 {
        let reason = match status {
            401 => "The token was rejected. Check it in Settings → Extensions.".to_string(),
            403 => "The token doesn't have permission for this.".to_string(),
            404 => "Not found. Check the extension's settings.".to_string(),
            429 => "Too many requests. Try again in a minute.".to_string(),
            _ => format!("{ext} answered {status}"),
        };
        return Err(reason);
    }
    if text.trim().is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

