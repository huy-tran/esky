# Esky progress

What is real, what is still a placeholder, and what to build next. Tick items off as they land.

Last updated: 6 Oct 2026 (Git, Password Generator, Script Commands dropped).

## Done (real and tested in the browser preview)

- [x] Launcher UI, dark and light
- [x] Search, frequency ranking, favourites, recents, aliases, hotkey recorder with conflict rules, actions menu (Ctrl K)
- [x] Themes and accent colour presets (Green, Blue, Violet, Rose, Amber, Teal)
- [x] Calculator and unit conversion (decimal places and separators from the Calculator preference)
- [x] Web search and quicklinks open real URLs
- [x] Dictionary (Wiktionary): parts of speech, word forms, pronunciation, examples
- [x] Laravel Herd sites from `~\.config\herd` (open in browser or editor, reveal, copy URL or path). Editors: VS Code, Cursor, Zed, PhpStorm
- [x] AI Chat and Quick AI through the user's Claude Code login (streaming, saved chats, follow-ups continue the session)
- [x] Plan usage (5-hour and weekly) in Settings → AI, with Refresh
- [x] Floating notes (saved)
- [x] One extension registry: Store and Settings share it; on/off switch hides commands from search
- [x] Generated preference forms per extension, with validation; URL commands use them (GitHub, Jira, Sentry, Laravel Docs, Tailwind)
- [x] Settings preview at real window size in the browser; real version and Windows info in About; Esky logo everywhere
- [x] Desktop build compiles and runs (`npm run tauri:dev`), no Rust errors or warnings
- [x] Alt Space opens the launcher while hidden
- [x] Tray icon and menu, single instance (a second launch exits)
- [x] Hide on blur, Mica
- [x] Separate Settings window (from the tray and from the launcher) and always-on-top floating note window; note edits sync between windows
- [x] Tokens in Windows Credential Manager (listed as `<extension>.<preference>.Esky`, e.g. `forge.token.Esky`)
- [x] Herd sites read through the fs plugin (63 sites, show in root search)
- [x] Running Claude Code from Rust (AI Chat)
- [x] Applications: everything in the Start menu's All apps (desktop and Store apps) with real icons, launched through `shell:AppsFolder`; Run as Administrator, Reveal in Explorer and Copy Path for apps with a known .exe. Rust `apps_list` / `app_icons` / `app_launch` (src-tauri/src/apps.rs). Desktop app only
- [x] Settings → Shortcuts: Esky's hotkey plus a hotkey and alias for every command and app (`app/composables/useHotkeys.ts` holds the rules for both windows)
- [x] Quicklinks you edit (Settings → Quicklinks); live currency rates (open.er-api.com, cached 6 hours); "Check for updates" against GitHub releases (repo passed in by the release workflow); Store installs are instant; onboarding shows real counts and saves every choice
- [x] System commands: Lock, Sleep, Restart, Shut Down, Sign Out (shutdown.exe), Empty Recycle Bin (with its real size), Eject All Drives; Do Not Disturb opens notification settings (no public API). Rust `system.rs`
- [x] Paste into the app Esky was opened from (Snippets, Emoji, Quick AI) and read its selected text for Quick AI: Esky sends Ctrl C / Ctrl V to that window and restores the clipboard afterwards. Rust `input.rs`; the window is remembered in Rust, so the page can only paste into the app you came from
- [x] Clipboard History: text, links, colours, images (saved as PNG in the app data folder) and files; paste back into the app you came from; pin, delete, clear; Settings → Clipboard (on/off, length, age, password managers via Windows' "don't record" clipboard flag, ignored apps). Rust `clipboard.rs` polls the clipboard change counter
- [x] Snippets you edit (Settings → Snippets) with {date}, {time}, {clipboard} and {cursor}; paste into the app you came from; typed-keyword expansion in any app (Rust `expand.rs`: a low-level keyboard hook keeps only the last 32 characters in memory, ignores Esky's own windows and injected keys)
- [x] Window Layouts on the window Esky was opened from: halves, thirds, centre, maximise, restore (to where it was before Esky moved it), next display; fitted to the work area and Windows 11's invisible borders. Rust `window.rs`. No default hotkeys (assign them in Settings → Shortcuts)
- [x] File Search: an in-memory index of file names in the folders from Settings → Extensions → File Search (skips node_modules, vendor, .git and build folders; reindexed every 15 minutes), Windows' Recent files, text and thumbnail previews, Open, Open With, Reveal, Copy Path, attach to AI Chat; top matches in root search. Rust `files.rs`
- [x] Media Controls (Windows media sessions: play/pause, next, previous; Spotify-only option), Docker (containers, Compose projects, images through the docker CLI: start, stop, restart, remove, logs in Windows Terminal), Colour Picker (click anywhere, crosshair, Esc cancels; Saved Colours in HEX/RGB/HSL). Rust `media.rs`, `docker.rs`, `colour.rs`
- [x] Laravel Forge through its current organisation API (`/orgs/{org}/…`): servers, sites with branches, recent deployments, real deploys followed to the end with the log, SSH in Windows Terminal. Calls go through Rust `api.rs`, which adds the token from Credential Manager and only allows each service's own address
- [x] AI with an Anthropic API key (Settings → AI): the key is saved in Credential Manager, Rust `anthropic.rs` streams from the Messages API (Opus 5.5, Sonnet 5.5 or Haiku 4.5; declined requests fall back server-side), chats replay their earlier turns since the API keeps no sessions
- [x] Google Translate (`utils/translate.ts`): the free endpoint Google's web widget uses (no key); the language pair is remembered and text in the second language goes back into the first
- [x] Raycast-style additions: your own AI commands (`useAiCommands.ts`), snippet `{argument}` values (also for typed expansion: the keyword is erased, Esky asks, then pastes), Developer Tools (`utils/devtools.ts`), time zones and date maths in search (`utils/timecalc.ts`), Switch Windows (Rust `switcher.rs`), Paste as Plain Text, Copy Text from Image (Rust `ocr.rs`, Windows.Media.Ocr), fallback searches (`utils/fallbacks.ts`), settings backup (`utils/backup.ts`), Google Calendar, and in-place updates (Rust `updates.rs`, Tauri updater)
- [x] GitHub (repositories with live search, your open pull requests, recent workflow runs), Jira (search issues or jump to a key, your open issues, log work with time and comment), Sentry (unresolved issues, releases) as lists inside Esky, through the same Rust client with your tokens
- [x] Git → Uncommitted Changes: repos with uncommitted changes or unpushed commits in the folders set in Settings → Extensions → Git (default `~\Herd`, `~\Frontend`); changed files, branch, open in editor or Windows Terminal. Rust `git_status` / `open_terminal` in the app, `server/api/git/status.get.ts` in the browser
- [x] Password Generator: password or passphrase with Bitwarden's options, defaults and rules (EFF long word list); options are saved, generated values never are

## Written but untested in the desktop app

- [ ] Command hotkeys while hidden
- [ ] Start at login (autostart plugin)
- [ ] Open on the active monitor (multi-monitor), Acrylic fallback on Windows 10

## Placeholders (sample data, actions only show a message)

None left.

## Next steps (in order)

1. [x] Install Rust and the Visual Studio C++ Build Tools, build the desktop app: `npm run tauri:dev`.
2. [x] Real app search and launching: Start menu shortcuts, Microsoft Store apps.
3. [x] Real Clipboard History: watch the clipboard, honour the ignore list and history settings, paste back. Values copied from the Password Generator aren't recorded.
4. [x] Real file search (chosen folders, plus Windows' Recent files).
5. [x] Paste into the previous app (needed by Snippets, Emoji, Clipboard, Quick AI) and read the selected text for Quick AI.
6. [x] Laravel Forge API with the saved token (servers, sites, deploy).
7. [x] Window layouts and system commands (Win32 calls from Rust).
8. [x] ~~Agent mode~~ removed.
9. [x] Live currency rates, update check (GitHub releases), API-key AI backend, model choice in Settings.

## Notes for whoever picks this up

- Dev server: `npm run dev` on http://localhost:1420 (port 3000 is used by another app on this machine).
- Desktop build needs Rust (stable, MSVC) and the Visual Studio 2022 Build Tools with the C++ workload. If a Nuxt dev server is already running, `npx tauri dev --config '{"build":{"beforeDevCommand":""}}'` reuses it. Quit Esky from the tray before rebuilding, or Cargo can't replace `esky.exe`.
- Nuxt is pinned to exactly 4.5.2 in `package.json`.
- App identifier is `app.esky.launcher`, so settings live in `%APPDATA%\app.esky.launcher\esky.json`.
- Debugging the desktop app: set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` before `tauri dev`, then attach Edge DevTools (`edge://inspect`) or any CDP client to each window.
- The Tauri store sends change events back to the window that made the change; `persistRef` ignores values it already has. Anything else that listens to the store must do the same, or it loops and freezes the app.
- Stay on Nuxt 4.5.2. Nuxt 4.6.0 (published 5 Oct 2026) renders every page as a 500 ("Either manifest or precomputed data must be provided"); retry on the next 4.6.x.
- Dev-only state jump: `/?scene=<key>` (keys in `app/composables/useScene.ts`).
- Browser-preview-only server routes: `server/api/herd/sites.get.ts`, `server/api/git/status.get.ts`, `server/api/claude/*`. The desktop app uses Tauri / Rust for the same things.
- Claude Code runs lean (no tools, MCP, skills or settings; ~750 tokens per message instead of ~120k). Flags are in `app/utils/claude.ts`. Plan usage comes from Claude Code's undocumented `rate_limit_event`, so it may change.
- Extensions: add or change one in `app/extensions/registry.ts`; Settings and the Store pick it up automatically.
- Updates are signed. The public key is in `src-tauri/tauri.conf.json`; the private key is kept outside the repo and given to the release workflow as the `TAURI_SIGNING_PRIVATE_KEY` secret (plus `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, empty if it has none). A local `npm run tauri:build` needs the same two environment variables, because the build also makes the signed update files. If the private key is lost, installed copies can't update to builds signed with a new key.
- New components need a dev server restart before `tauri:dev` shows them.
- Dropped on purpose: Script Commands and Laragon (not used). Herd Mail was skipped: Herd has no deep link, API route or CLI command that opens its Mails window. Its mails are in `~\.config\herd\herd.sqlite` (`Mails` table) if an inbox in Esky is wanted later.
- New component files sometimes don't register with a long-running `nuxt dev` ("Failed to resolve component"); restart the dev server.
- Icons are bundled when the dev server starts, so a Lucide icon used for the first time shows blank until `nuxt dev` restarts. Production builds scan every file.
