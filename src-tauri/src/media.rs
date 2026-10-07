//! Media Controls: play/pause and skip in whatever is playing, through Windows' media sessions
//! (the ones the volume flyout shows): Spotify, browsers, most players.

use windows::Media::Control::{GlobalSystemMediaTransportControlsSession as Session, GlobalSystemMediaTransportControlsSessionManager as Manager};

#[derive(serde::Serialize)]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    /// The app playing it (its AppUserModelID, e.g. "Spotify.exe").
    pub app: String,
    pub playing: bool,
}

fn err(e: windows::core::Error) -> String {
    e.message().to_string()
}

/// The session to control: Spotify's when `spotify_only`, otherwise the one Windows considers current.
fn session(spotify_only: bool) -> Result<Session, String> {
    let manager = Manager::RequestAsync().map_err(err)?.join().map_err(err)?;
    if spotify_only {
        let sessions = manager.GetSessions().map_err(err)?;
        for s in sessions {
            if s.SourceAppUserModelId().map(|id| id.to_string().to_lowercase().contains("spotify")).unwrap_or(false) {
                return Ok(s);
            }
        }
        return Err("Spotify isn't playing anything".into());
    }
    manager.GetCurrentSession().map_err(|_| "Nothing is playing".to_string())
}

fn now_playing(s: &Session) -> NowPlaying {
    let props = s.TryGetMediaPropertiesAsync().ok().and_then(|op| op.join().ok());
    let playing = s
        .GetPlaybackInfo()
        .and_then(|i| i.PlaybackStatus())
        .map(|st| st == windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);
    NowPlaying {
        title: props.as_ref().and_then(|p| p.Title().ok()).map(|t| t.to_string()).unwrap_or_default(),
        artist: props.as_ref().and_then(|p| p.Artist().ok()).map(|t| t.to_string()).unwrap_or_default(),
        app: s.SourceAppUserModelId().map(|t| t.to_string()).unwrap_or_default(),
        playing,
    }
}

/// "toggle", "next" or "previous"; returns what's playing afterwards.
pub fn control(action: &str, spotify_only: bool) -> Result<NowPlaying, String> {
    let s = session(spotify_only)?;
    let op = match action {
        "toggle" => s.TryTogglePlayPauseAsync(),
        "next" => s.TrySkipNextAsync(),
        "previous" => s.TrySkipPreviousAsync(),
        _ => return Err("Unknown action".into()),
    }
    .map_err(err)?;
    if !op.join().map_err(err)? {
        return Err("The player didn't accept that".into());
    }
    // Give the player a moment to update its title and state.
    std::thread::sleep(std::time::Duration::from_millis(400));
    Ok(now_playing(&s))
}
