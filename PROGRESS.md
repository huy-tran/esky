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
- [x] Git → Uncommitted Changes: repos with uncommitted changes or unpushed commits in the folders set in Settings → Extensions → Git (default `~\Herd`, `~\Frontend`); changed files, branch, open in editor or Windows Terminal. Rust `git_status` / `open_terminal` in the app, `server/api/git/status.get.ts` in the browser
- [x] Password Generator: password or passphrase with Bitwarden's options, defaults and rules (EFF long word list); options are saved, generated values never are

## Written but untested in the desktop app

- [ ] Command hotkeys while hidden
- [ ] Start at login (autostart plugin)
- [ ] Open on the active monitor (multi-monitor), Acrylic fallback on Windows 10

## Placeholders (sample data, actions only show a message)

| Area | What is fake |
|---|---|
| Search Files | 8 sample files; Open / Open With do nothing; Reveal and Copy Path use fake paths |
| GitHub, Jira, Sentry extensions | Commands only open a web page; the saved tokens are never used |
| Clipboard History | 9 sample items; nothing is recorded; Paste does nothing; Clipboard settings tab is saved but unused |
| Snippets | 7 samples you can't edit; Paste does nothing; no keyword expansion in other apps (Copy works) |
| Window layouts | Applying a layout moves nothing |
| Laravel Forge | 6 sample servers; Deploy is a timed fake; SSH does nothing; the API token is never used |
| Snippets typed-keyword expansion | Not built yet (see Snippets) |
| Colour Picker, Media Controls, Docker | Commands are fakes (preference forms work) |
| Settings → AI | The API-key backend isn't connected |

## Next steps (in order)

1. [x] Install Rust and the Visual Studio C++ Build Tools, build the desktop app: `npm run tauri:dev`.
2. [x] Real app search and launching: Start menu shortcuts, Microsoft Store apps.
3. [ ] Real Clipboard History: watch the clipboard, honour the ignore list and history settings, paste back. Don't record values copied from the Password Generator.
4. [ ] Real file search (Windows Search index or chosen folders).
5. [ ] Paste into the previous app (needed by Snippets, Emoji, Clipboard, Quick AI) and read the selected text for Quick AI.
6. [ ] Laravel Forge API with the saved token (servers, sites, deploy).
7. [ ] Window layouts and system commands (Win32 calls from Rust).
8. [ ] Agent mode: Claude Code tools with Esky's approval dialog and the allowed-tools list.
9. [ ] Live currency rates, real updater (Tauri updater plugin), API-key AI backend, model choice in Settings.

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
- Dropped on purpose: Script Commands and Laragon (not used). Herd Mail was skipped: Herd has no deep link, API route or CLI command that opens its Mails window. Its mails are in `~\.config\herd\herd.sqlite` (`Mails` table) if an inbox in Esky is wanted later.
- New component files sometimes don't register with a long-running `nuxt dev` ("Failed to resolve component"); restart the dev server.
- Icons are bundled when the dev server starts, so a Lucide icon used for the first time shows blank until `nuxt dev` restarts. Production builds scan every file.
