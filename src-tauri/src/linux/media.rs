//! Media Controls: play/pause and skip in whatever is playing, through MPRIS (`playerctl`):
//! Spotify, browsers, most players.

use super::util;

#[derive(serde::Serialize)]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    /// The player playing it (e.g. "spotify").
    pub app: String,
    pub playing: bool,
}

/// "toggle", "next" or "previous"; returns what's playing afterwards.
pub fn control(action: &str, spotify_only: bool) -> Result<NowPlaying, String> {
    let verb = match action {
        "toggle" => "play-pause",
        "next" => "next",
        "previous" => "previous",
        _ => return Err("Unknown action".into()),
    };
    let player: Vec<&str> = if spotify_only { vec!["--player=spotify"] } else { vec![] };
    let with = |rest: &[&str]| -> Vec<String> { player.iter().chain(rest).map(|s| s.to_string()).collect() };
    let call = |rest: &[&str]| {
        let args = with(rest);
        util::run("playerctl", &args.iter().map(String::as_str).collect::<Vec<_>>())
    };
    call(&["status"]).map_err(|e| if e.contains("isn't installed") { e } else if spotify_only { "Spotify isn't playing anything".into() } else { "Nothing is playing".into() })?;
    call(&[verb]).map_err(|_| "The player didn't accept that".to_string())?;
    // Give the player a moment to update its title and state.
    std::thread::sleep(std::time::Duration::from_millis(400));
    let meta = call(&["metadata", "--format", "{{playerName}}\t{{artist}}\t{{title}}\t{{status}}"]).unwrap_or_default();
    let mut f = meta.trim_end_matches('\n').split('\t');
    let (app, artist, title, state) = (f.next().unwrap_or(""), f.next().unwrap_or(""), f.next().unwrap_or(""), f.next().unwrap_or(""));
    Ok(NowPlaying { title: title.into(), artist: artist.into(), app: app.into(), playing: state == "Playing" })
}
