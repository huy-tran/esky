# Changelog

All notable changes to Esky are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Applications: search and open everything in the Start menu (desktop and Microsoft Store apps) with their real icons; Run as Administrator, Reveal in Explorer and Copy Path.
- Settings → Shortcuts: change Esky's hotkey, and give any command or app a system-wide hotkey or an alias, in one place. Also opens from the "Keyboard Shortcuts" command.
- Quick AI without selected text asks for the text (filled in from the clipboard) and runs on it. Translate, Explain Code, Summarise and Write Commit Message are now in search too.
- Quicklinks you can add and edit, live currency rates, and a real "Check for updates" against GitHub releases.
- System commands that work: Lock, Sleep, Restart, Shut Down, Sign Out, Empty Recycle Bin and Eject All Drives. Do Not Disturb opens Windows' notification settings.
- Paste into the app Esky was opened from, and Quick AI on the text selected there.
- Clipboard History: text, links, colours, images and files, with pinning and paste back. Password managers and ignored apps aren't recorded.
- Snippets you can edit, with placeholders and typed-keyword expansion in any app.
- Window Layouts on the window Esky was opened from.
- File Search across the folders you choose and Windows' Recent files, with previews.
- Media Controls, Docker containers and images, and a Colour Picker that works anywhere on screen.
- Laravel Forge: servers, sites, deployments with their log, and SSH.
- GitHub, Jira (including Log Work) and Sentry commands that load your own data.
- AI Chat and Quick AI can use an Anthropic API key instead of Claude Code, with a choice of model.
- Google Translate: translate between two languages you pick (remembered), in either direction, with side-by-side text boxes; `tr` and your text from root search, or Ctrl 5 on selected text.

### Removed

- The sample applications and files in search results, which opened nothing.
- Agent mode.
- The Quick AI "Translate English ↔ Vietnamese" command (Google Translate replaces it). Quick AI shortcuts are now Ctrl 1 to Ctrl 4.
- Default system-wide hotkeys for features that don't work yet (Ctrl Shift V for Clipboard History, Ctrl Alt arrows for window layouts), which took those keys away from other apps.

## 0.1.0 - 2026-10-07

First release.

### Added

- Keyboard launcher for Windows: Alt Space opens it from anywhere, it lives in the tray and hides when it loses focus.
- Search with frequency ranking, favourites, recents, aliases, per-command hotkeys and an actions menu (Ctrl K).
- Calculator and unit conversion in root search.
- Web search and quicklinks.
- Dictionary (English, from Wiktionary).
- Laravel Herd sites: open in the browser or an editor (VS Code, Cursor, Zed, PhpStorm), reveal, copy the URL or path.
- Git → Uncommitted Changes: repos with uncommitted changes or unpushed commits in the folders you choose, with their changed files.
- Password Generator: passwords and passphrases with Bitwarden's options.
- AI Chat and Quick AI through your Claude Code sign-in, with saved chats.
- Floating notes that stay on top of other windows.
- Extensions with generated preference forms; tokens are kept in Windows Credential Manager.
- Settings window with themes and accent colours.
