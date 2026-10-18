# Esky

Keyboard launcher for Windows and Linux (Omarchy). Nuxt 4 + Nuxt UI v4 + Tailwind v4, packaged with Tauri 2.

Press Alt Space anywhere (on Linux, through the Hyprland key below) to search apps, files, commands and open windows, and to calculate, convert currencies and units, and work out times across time zones.

**[Try the demo in your browser](https://esky-ece.pages.dev/)** (press Alt Space to reopen the launcher if you hide it).

![Root search converting 3pm Sydney to London time](docs/screenshots/search.png)

| | |
|---|---|
| ![Clipboard History with text, links, colours and code](docs/screenshots/clipboard.png) | ![AI Chat answering a Laravel question](docs/screenshots/chat.png) |
| **Clipboard History.** Text, links, colours, images and files, pinned or pasted back into the app you came from. | **AI Chat and Quick AI.** Through your Claude Code login or an Anthropic API key, plus your own AI commands for selected text. |
| ![Google Translate between English and Spanish](docs/screenshots/translate.png) | ![Developer Tools formatting JSON](docs/screenshots/devtools.png) |
| **Google Translate.** Between two languages you pick, in either direction. | **Developer Tools.** JSON, Base64, URL encoding, hashes, timestamps, JWTs and UUIDs. |

Also: snippets with typed-keyword expansion, quicklinks, window layouts and switching, file search, colour picker, media controls, password generator, dictionary, and extensions for Laravel Forge, Herd, GitHub, Jira, Sentry, Docker and Google Calendar.

![Settings window, Extensions tab](docs/screenshots/settings.png)

## Requirements

- Node 22+
- For the desktop app on Windows: Rust (stable, MSVC toolchain), the Visual Studio 2022 Build Tools with the "Desktop development with C++" workload, and the WebView2 runtime. Install Rust from https://rustup.rs.
- For the desktop app on Linux (Omarchy): Rust, plus `sudo pacman -S --needed webkit2gtk-4.1 base-devel xdotool librsvg libayatana-appindicator`. Features use tools Omarchy already has (`hyprctl`, `wl-clipboard`, `playerctl`, `hyprpicker`); `tesseract` is optional, for reading text in copied images.

## Run

```bash
npm install
npm run dev          # browser build at http://localhost:1420
npm run tauri:dev    # desktop app (needs Rust)
npm run tauri:build  # installers in src-tauri/target/release/bundle: NSIS + MSI on Windows; deb, rpm and AppImage on Linux (add `-- --bundles appimage` for just the AppImage)
```

In the browser build there is no tray: press Alt Space (or click the "Esky is hidden" button) to reopen the launcher.

## Release

1. Bump `version` in `package.json` (Tauri reads it from there) and in `src-tauri/Cargo.toml`.
2. Move the notes under **Unreleased** in `CHANGELOG.md` to a new `## <version> - <date>` section.
3. Commit and push to `master`. That's it, don't tag by hand.

`.github/workflows/release.yml` sees the new version in `package.json`, builds the NSIS and MSI installers on Windows, and publishes a GitHub release (creating the `v<version>` tag) with that version's changelog notes. A `package.json` change without a version bump is skipped, because its release already exists. Pushing a `v<version>` tag yourself still works.

## Linux (Omarchy)

- **Open with a key.** Wayland has no app-wide shortcuts, so bind a key in Hyprland (Omarchy: `~/.config/hypr/bindings.conf`). A second `esky` hands over to the running one, which notes the app in front first, so paste-back and selected text work as on Windows. Check that Alt Space isn't already bound:
  ```
  bind = ALT, SPACE, exec, esky --toggle
  ```
  For an AppImage, give its file path in place of `esky`. Per-command hotkeys from Settings → Shortcuts only work while Esky is open; bind those in Hyprland too for system-wide use.
- **Window rules.** Hyprland tiles new windows, so make the launcher float, centre and stay on top. Check its title or class with `hyprctl clients` while it's open. Rule syntax depends on your Hyprland version. For 0.53 and later:
  ```
  windowrule = match:title ^(Esky)$, float on, center on, pin on
  ```
  Older versions use `windowrulev2 = float, title:^(Esky)$`, and the same for `center` and `pin`.
- **Start at login:** add `exec-once = esky` to your Hyprland config.
- **Tray:** needs a tray host (Waybar's tray module). Left click on the tray icon isn't reported on Linux; use its menu.
- **Saved tokens** (Forge, GitHub, Jira, Sentry, API key) go to the Secret Service, so GNOME Keyring (or KeePassXC with Secret Service on) must be running.
- **AppImage:** may need `fuse2` on Arch. If the window opens blank, run it with `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
- **Not on Linux:** text expansion (needs to see every key), Open With, Run as Administrator, Mica and Acrylic, Herd (no Linux version), file thumbnails.

### Jump to a state (dev only)

`http://localhost:1420/?scene=<key>` opens the launcher in a given state, e.g. `?scene=clip`, `?scene=hkConflict`, `?scene=onboard`. Keys are listed in `app/composables/useScene.ts`.

## Layout

| Path | What |
|---|---|
| `app/pages/index.vue` | Launcher window: global key map, blur-to-hide, global shortcuts |
| `app/pages/settings.vue` | Settings window (900 × 620) |
| `app/pages/float.vue` | Always-on-top floating note window |
| `app/composables/useLauncher.ts` | Launcher state, models, actions and the full key map |
| `app/composables/usePlatform.ts` | Tauri bridge (windows, shortcuts, clipboard, opener, autostart); no-ops in the browser |
| `app/composables/usePersist.ts` | Persistence: Tauri store (`esky.json`) or localStorage |
| `app/data/fixtures.ts` | Sample data. Replace with real providers |
| `app/utils/herd.ts`, `app/composables/useHerd.ts` | Laravel Herd sites from `~\.config\herd` (Tauri fs in the app, `server/api/herd/sites.get.ts` in the browser dev build) |
| `app/extensions/registry.ts` | Every extension: commands, preference fields, defaults. Settings and the Store read from here |
| `app/composables/useExtensions.ts`, `useSecrets.ts` | Installed / turned-on extensions, saved preferences, tokens (Windows Credential Manager in the app) |
| `app/utils/claude.ts`, `app/composables/useClaude.ts` | AI Chat and Quick AI through your Claude Code CLI (lean flags, stream parsing, plan usage). Desktop: Rust `claude_run`; browser preview: `server/api/claude/*` |
| `app/utils/dictionary.ts` | English dictionary via Wiktionary: senses, examples, pronunciation and word forms |
| `app/utils/git.ts`, `app/composables/useGitRepos.ts` | Git → Uncommitted Changes: parses `git status` for repos in the configured folders. Desktop: Rust `git_status`; browser preview: `server/api/git/status.get.ts` |
| `app/utils/password.ts`, `app/composables/usePassword.ts` | Password Generator (Bitwarden's options and rules); passphrases use `app/data/eff-wordlist.ts` |
| `app/components/launcher/` | Views, rows, dialogs, footer, onboarding |
| `src-tauri/` | Tauri shell: tray, Mica/Acrylic, single instance, plugins, capabilities |

Design tokens live in `app/assets/css/main.css` (both themes). Nuxt UI is themed in `app/app.config.ts`.

## License

MIT. See [LICENSE](LICENSE).
