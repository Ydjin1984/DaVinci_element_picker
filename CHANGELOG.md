# Changelog

All notable changes to **DaVinchi** are documented in this file.

## [0.1.32] — 2026-08-11

### Added
- **`scripts/setup-windows-cdp.ps1`** — one command that prepares a Windows machine for the “extension on the SSH server” setup. Until now that setup existed only as a sequence of manual steps nobody could reproduce from the repository. The script needs no administrator rights and is idempotent: it writes the Chrome launcher (separate profile, because Chrome 136+ refuses the debug port on the default one), a logon entry, a watchdog task that restores the browser within two minutes, the `davinchi-chrome:` URI handler that lets **Open browser** start Chrome from the server, and `RemoteForward` in `~/.ssh/config` for the host you name. `-Uninstall` removes all of it

### Changed
- **Documentation rewritten around the two real topologies.** README, `INSTALL.md`, and `docs/INSTALL.ru.md` now open with the rule that decides everything — install the extension on the machine you are sitting at — then describe the remote-server case as two explicit setups: extension local (nothing to configure) or extension on the server (one command). Added a troubleshooting section covering every failure this project actually hit: the `workspace · linux` badge, an unreachable debug port, the default-profile restriction, and the browser being closed
- `scripts/github-release.ps1` publishes through the GitHub API when `gh` is missing or not logged in, using the token the git credential helper already holds — the previous version simply failed, since a working `git push` does not imply a working `gh auth`

### Removed
- `scripts/publish-github.ps1` — one-time bootstrap for creating the repository, obsolete since it exists
- Internal AI-collaboration log and its watcher script are no longer tracked in the repository

## [0.1.31] — 2026-08-11

### Added
- **Open browser starts the browser on your machine even when DaVinchi runs on the SSH server.** Closing that browser used to end the session for good: the next Open browser could only report that `localhost:9222` was unreachable, and the user had to go start Chrome by hand. The extension now asks the local machine to launch it — `vscode.env.openExternal("davinchi-chrome://start")` is handled by the editor client on that machine, so the URI handler registered there starts the debug Chrome — then waits for the endpoint (up to 15 s) and connects. With no handler registered nothing opens and the previous error path is unchanged
- The wake-and-retry runs in `browserMode: cdp` and in `auto` whenever CDP is the preferred route (extension hosted on a remote Linux workspace)

### Changed
- The CDP reachability probe lives in `browserSession` and is shared with the activation check instead of being duplicated

## [0.1.30] — 2026-08-11

### Changed
- **Running on the SSH server is now a supported setup, not an error.** DaVinchi installed on the remote host drives the browser on your PC over a reverse-forwarded CDP port, and picks are written into the server workspace as before. On activate the extension probes the configured `elementPicker.cdpEndpoint` and stays completely silent when that link answers — earlier builds warned on every start regardless of whether anything was actually broken
- The warning now appears **only** when the extension is remote-hosted *and* the endpoint does not answer, and it says which endpoint was tried. Its buttons copy the Chrome start script or the full setup steps: start Chrome with the debug port on your PC → `RemoteForward 9222 localhost:9222` in `~/.ssh/config` → verify from the SSH terminal with `curl $endpoint/json/version`. Installing the extension locally is now documented as the alternative topology rather than the only correct one
- Dropped the automatic write of `remote.extensionKind` and the self-uninstall path — both pushed the extension towards the local machine, which is wrong when the server-side install is deliberate

### Fixed
- **Default `cdpEndpoint` could never connect to a current Chrome.** Chrome 148 answers `/json/version` on `http://localhost:9222` but returns nothing for `http://127.0.0.1:9222`, and `127.0.0.1` was the shipped default — so every CDP attempt failed before it began. Verified end to end: local Chrome with `--remote-debugging-port=9222`, `ssh -R 9222:localhost:9222`, and the endpoint answering from the server through the tunnel. The default is now `http://localhost:9222`

## [0.1.29] — 2026-08-11

### Fixed
- **Toast loop on a mis-hosted install** — field evidence from a real Remote SSH session: the server-side copy wrote `remote.extensionKind → ui`, the reload changed nothing, and the same “forced → Reload Window” toast came back on every activation. `remote.extensionKind` is application-scoped, so a remote extension host cannot read the value that lives in the local User settings and kept believing the override was never written. The attempt is now remembered in `globalState`, so the second activation goes straight to the message that names the real blocker (remove the server-side copy of the extension)
- **Settings pollution** — the merge was built on the *effective* configuration value, which carries VS Code's schema default `{"pub.name": ["ui"]}`; that placeholder was then persisted into the user's `settings.json`. The override now merges onto the user's own value from `inspect().globalValue`

## [0.1.28] — 2026-08-11

### Fixed
- **Remote SSH / Cursor: extension stuck as `workspace · linux`** — on activate, when the host is a remote Linux workspace, DaVinchi now writes User setting `remote.extensionKind["coin-rebalancer.element-picker"] = ["ui"]` and offers **Reload Window**. Expanded copyable fix steps (uninstall Remote copy, force UI, reinstall local VSIX). This addresses the real user failure mode after 0.1.27 where Open browser showed “running on the REMOTE host” even with a local VSIX present.
- **No more reload loop when the override does not help** — the settings write is verified through `inspect()` instead of assuming success, and the three states are now distinguished: just forced (offers **Reload Window**), already forced but still hosted remotely (new message: remove the **server-side copy** of the extension — the editor keeps one under `~/.vscode-server/extensions/` and `~/.cursor-server/extensions/`), or write failed (generic install-locally hint). Reload is offered only in the state where it can actually change the outcome
- Copyable fix steps reference the **running version** of the VSIX instead of a hardcoded file name, and now include the exact server-side cleanup commands

## [0.1.27] — 2026-08-11

### Fixed
- **Remote SSH: «браузер не запускается» / вместо Chrome стартовал Edge** — закрыт весь класс сбоев:
  - CDP-first теперь применяется **только** к реально mis-hosted установке (extension host на удалённом Linux workspace, проверка по фактическому `extensionKind`) и работает даже при заданном `DISPLAY` (X11/VNC) — серверное окно браузера никогда не используется для интерактивного pick. UI-хосты (win32/darwin/Linux-десктоп) сохраняют launch-first из 0.1.26
  - **CDP-хелпер запускал Edge вместо Chrome**: `Start Local Chrome (CDP)` теперь проверяет все стандартные пути Chrome (LOCALAPPDATA, Program Files, Program Files (x86)) и `elementPicker.browserPath` до фолбэка на Edge; при фолбэке скрипт печатает NOTE
  - **CDP-хелпер уходил в удалённый терминал**: под Remote SSH `createTerminal` может открыть серверный shell, где нет `powershell.exe` — хелпер теперь запускает PowerShell напрямую на UI-хосте через `child_process.spawn` (паттерн webview repair), detached
  - **Attach-пути были нечитаемы на сервере**: при удалённом workspace абсолютные `fsPath` приходили с win32-разделителями (`\home\user\…`) — attach-блок восстанавливает POSIX-форму; локальные file-workspace не затронуты
  - **Mis-hosted установка теперь заметна**: на activate показывается предупреждение с кнопкой «Copy fix steps» (переведено на все 18 локалей); ошибка Open Browser несёт суть в первой строке (видна в тосте) и точные шаги `ssh -R 9222:127.0.0.1:9222` / `RemoteForward`
  - `ensureBrowserPathSetting` больше не предлагает серверный бинарник на mis-hosted workspace-хосте даже при заданном `DISPLAY`

### Changed
- **Документация описывает реальную архитектуру**: README / INSTALL / INSTALL.ru начинаются с «установите VSIX локально → Chrome открывается на вашем ПК → пики сохраняются в удалённый workspace»; CDP-ритуал перенесён в advanced-fallback

## [0.1.26] — 2026-08-09

### Fixed
- **Remote SSH: Chrome opens on the local PC again** (regression after 0.1.23–0.1.25). `extensionKind` is **`ui` only** so the extension host is always your Windows/macOS machine; Open browser launches local Chrome/Edge even when the workspace is Remote SSH (same as 0.1.22)
- **No more forced CDP PowerShell dump** on Open browser failure — short error only; CDP helper remains as optional commands
- **Start Local Chrome (CDP)** runs on `win32` even when `remoteName` is set (UI host under SSH)

### Changed
- Install VSIX on the **local** Cursor/VS Code (UI). Badge must show `v0.1.26 · ui · win32`, not `workspace · linux`

## [0.1.25] — 2026-08-09

### Fixed
- **Remote SSH: no more server-side Playwright Chromium launch** — when the extension host is Linux without `DISPLAY`, auto mode uses **CDP only** (local Chrome on your PC via reverse-forwarded `9222`). Headless Chromium under `~/.cache/ms-playwright/` is no longer treated as a launchable browser for interactive pick
- **Poisoned `browserPath`**: Playwright-cache paths are ignored and cleared so Remote SSH recovery does not keep retrying a server binary
- **CDP wizard**: open failures on Remote SSH (ECONNREFUSED / without DISPLAY) always open the “Start Local Chrome (CDP)” flow instead of a dead-end launch error
- **Workspace host warning** on activate when extensionKind is workspace under Remote SSH, with copyable fix steps (install VSIX as local UI, or CDP)

## [0.1.24] — 2026-08-09

### Fixed
- **Clone mode re-apply after re-open/re-navigate**: when the browser is already open and a new URL is loaded, Clone mode (not only Select) is restored on the page after picker reinstall
- **Concurrent `open(url)`**: stacked Open Browser calls keep the **latest** URL and navigate to it after the in-flight open finishes (no dropped requests)
- **Asset download size guard**: CDP + in-page fetch skip oversized responses via `Content-Length` and body length (`maxBytes`, default 6–8 MB)
- **ZIP entry names**: path segments `.` / `..` stripped (defense-in-depth)
- **Local Chrome CDP helper URL**: control characters stripped before PowerShell embedding

### Changed
- **i18n**: clone mode / status / toast / terminal-prompt strings translated for all 18 locales (no longer fall through to English outside `en`/`ru`)
- **`browserPath` discovery**: no longer silently writes the discovered Chrome path into User settings; only an explicit user setting is persisted
- **README / INSTALL**: full commands + settings tables, Remote SSH CDP flow, version `0.1.24`; marketplace-safe images live under `media/` (shipped in VSIX)
- **Package script**: dropped obsolete `--allow-missing-repository` (repository is set)

## [0.1.23] — 2026-08-09

### Added
- **Version badge in UI** (ported from GitHub 0.1.28–0.1.29, browser stack stays 0.1.22): panel header chip + host bar, status bar (`vX.Y.Z` after mode text), Controls tree tag row, and action menu title show `vX.Y.Z · ui|workspace · platform` so Local vs Remote host is obvious at a glance
- `hostInfo.ts` — single source for package version, extensionKind, platform, remoteName

## [0.1.22] — 2026-08-08

### Fixed
- **Packaging leak**: VSIX no longer bundles private workspace junk (`.element-picks/`, `clones/`, `finandy*`, `.claude/`, `scripts/`, stray HTML). Package size back to ~3–4 MB
- **Terminal attach safety**: multi-line attach blocks are flattened before `terminal.sendText` so `\n` is not executed as Enter in a normal shell
- **Browser settings hardening**: `browserPath` / `browserMode` / `cdpEndpoint` / `browserChannel` are application-scoped (workspace cannot inject an executable path); Restricted Mode ignores custom `browserPath`
- **Editor panel dispose**: "Open Rich UI in Editor" no longer throws after panel close (unbind uses a pre-captured webview reference)
- **Pick race during clone capture**: clicks while screenshots run are ignored; each pick gets a unique `pickToken` on `data-davinchi-picked` so the crop cannot jump to another card mid-capture (`PICKER_VERSION` 5)
- **Stale `latest/` after light pick**: normal picks wipe `latest/` first so an old clone pack cannot sit next to fresh `context.md` / `element.png`
- **Asset download hang**: in-page fetch fallback now times out (~12–14 s); CDP request timeout tightened to 15 s
- **ZIP Cyrillic names**: set UTF-8 general-purpose bit so Expand-Archive / Info-ZIP decode non-ASCII entry names correctly

### Added
- Project release skill `davinchi-release` (preflight: panel script, commands, settings, CHANGELOG, VSIX junk audit)

## [0.1.21] — 2026-08-07

### Fixed
- Hover highlight "stopped working" after the first clone capture: the **one-shot clone mode** introduced in 0.1.19 shipped enabled by default, so after one successful capture the Clone mode silently deactivated itself — the crosshair and the purple frame disappeared and further hovers highlighted nothing until the mode was re-enabled. `elementPicker.cloneOneShot` now defaults to **off** (continuous clone mode, as before 0.1.19); enable the checkbox in Clone settings if you want the activate–click–done flow
- Verified with an end-to-end headless-Chrome run driving the real `BrowserSession`: clone highlight → pick → screenshots → one-shot off reproduced the vanished highlight; select mode and the injected picker itself were confirmed healthy (highlight, pick, capture/restore cycle, CSP sites)

## [0.1.20] — 2026-08-07

### Fixed
- Panel: the connected-URL row (green dot + address + **Close browser**) stayed visible after the browser was closed, and the "No captures yet" placeholder could show together with the last-capture card. Root cause: the author CSS `display: flex` on `.conn-row`/`.empty` overrides the browser's built-in `[hidden] { display: none }`, so `el.hidden = true` had no visual effect. Added an explicit `[hidden] { display: none !important; }` reset to the webview stylesheet
- Verified with a headless-Chrome test driving the real panel HTML through open → close → capture state transitions (33 checks), including a regression run against the old CSS that reproduces the stuck row

## [0.1.19] — 2026-08-07

### Added
- **Clone settings panel**: collapsible section in the sidebar/editor panel with checkboxes for everything the clone pack writes — zip archive, `latest/` mirror, standalone `preview.html`, asset downloads, full-page/parent screenshots, style dumps (`computed.json`/`fonts.json`), inline SVGs. Auto-expands when Clone mode turns on and highlights while it is active; state is saved to **User settings** (10 new booleans `elementPicker.clone*`), so it persists across restarts and workspaces. Localized in all 18 languages
- **Clone whole page** (`elementPicker.cloneFullSite`, default off): any click in Clone mode captures the entire site page — full document HTML (up to 3 MB), all styles, fonts, assets (asset budget raised to 150) — a complete site reference instead of a single element. Highlight label shows `CLONE PAGE`
- **One-shot clone mode** (`elementPicker.cloneOneShot`, default **on**): after a successful capture the Clone mode deactivates itself — activate, click, done; no manual toggle-off
- Toggling **Clone the whole page** while the browser is open pushes the flag into the live page immediately

### Changed
- `clone.zip` is now **off by default** (was the main reason packs grew huge); enable it with one checkbox when needed. The old `elementPicker.clonePackExtras` enum setting is replaced by the granular booleans above
- Disabled parts of the pack are also skipped in `CLONE.md`/`AGENT.md` file lists, screenshots are not even captured when their checkbox is off (faster picks on long pages)
- Manifest cleanup: redundant `activationEvents` removed (auto-generated by VS Code ≥1.74 from contributions), views got explicit `icon`

## [0.1.18] — 2026-08-07

### Added
- **DaVinchi: Fix Webview Cache (restart editor)** command (`elementPicker.fixWebviewCache`) — one-click cure for the editor-level error `Could not register service worker: InvalidStateError`. Arms a detached PowerShell watcher that waits for the editor to close, deletes the corrupted `<userData>/Service Worker` cache and relaunches the editor automatically. Available in the command palette, the Controls tree (Advanced) and the action menu. Windows-only; on other platforms shows the manual path to delete
- `scripts/fix-webview-cache.ps1` — standalone repair script for VS Code and Cursor (clears the Service Worker cache of closed editors; `-Wait` waits for a running editor to close first)

### Why
The `InvalidStateError` comes from the editor's own webview Service Worker whose on-disk cache got corrupted — no extension code can prevent it, but repair is now one action instead of a manual cache hunt.

## [0.1.17] — 2026-08-07

### Fixed
- `element.png` no longer crops the wrong area when a slider/carousel moves the element between pick and capture (e.g. Revolution Slider slide gave 1703×62 instead of 1703×700): the live element box is validated against the box saved at pick time, otherwise the saved rect is used for the crop — same path that already produced a correct `parent.png`
- `@font-face` fonts referenced with relative `url(...)` now resolve against the **stylesheet** URL, not the page URL (previously icon fonts like FontAwesome/eicons/revicons resolved to the site root and failed with 404 — 21 of 56 assets in a real capture)
- Matched CSS, keyframes and `@font-face` blocks written to `styles.css`/`CLONE.md` get relative `url(...)` rewritten to absolute, so assets can be re-downloaded from the pack

### Added
- Lazy-load attributes (`data-lazyload`, `data-src`, `data-lazy-src`, `data-original`) are collected as image assets — real files behind `dummy.png`-style placeholders land in `assets/`
- `CLONE.md`: new "Capture pitfalls" section (screenshot sanity check vs Box size, lazy-load placeholders, canvas snapshots, remote URLs in `subtree.html`); `AGENT.md`: reference-validation step and lazy-load/canvas notes

## [0.1.16] — 2026-08-07

### Changed
- **Redesigned sidebar panel**: sectioned layout (Page / Capture mode / Last capture), brand header with connection pill, mode tiles with descriptions and shortcuts, live status line (idle / connected / busy / error), last-capture card with Terminal / Copy / Folder actions, empty state, language picker + collapsible "How it works" in the footer
- Controls tree grouped into Browser / Capture / Last capture / Advanced, fully localized
- Action menu (QuickPick) grouped with separators and mode descriptions
- Terminal attach block is now shell-neutral (quoted paths, no PowerShell `&`) — works in PowerShell, cmd, bash and zsh, including paths with spaces/Cyrillic
- `@mention` hints respect a custom `elementPicker.outputDir`

### Fixed
- ReDoS hang in data-URL parsing during clone capture (malicious/broken `data:` URI could freeze the extension host)
- CDP session close now really disconnects (no leaked connections; stale handlers no longer wipe a new session's state)
- Element screenshot could capture the wrong element when the short selector was not unique — the picked node is now marked and captured precisely
- Hover highlight no longer leaks into screenshots when the mouse moves during capture
- Shadow DOM: picking inside open web components now selects the inner element, not the host
- `latest/` folder is cleaned before each clone save (no mixing of files from different captures)
- `clone/preview.html` renders the captured subtree in isolated Shadow DOM and strips active content (inline handlers, scripts, iframes)
- Browser-open errors are routed correctly: CDP wizard only for CDP failures, real launch errors shown as-is
- Double-click on "Open browser" no longer spawns two browsers; Esc in the URL prompt cancels silently
- `file://` and other schemes are no longer rewritten to `http://`
- Playwright cache discovery on Windows/macOS (`%LOCALAPPDATA%\ms-playwright`, `~/Library/Caches`)
- Asset download limit no longer consumed by failed entries; oversized data-URLs deduplicated
- Markdown packs survive page content containing ``` fences or `|` in URLs
- Clone zip is built once (was compressed and written twice); CRC32 uses a lookup table
- `elementPicker.outputDir` is validated (no `..`, absolute paths or invalid characters)
- Status bar clone label localized

## [0.1.15] — 2026-08-07

### Added
- Setting **`elementPicker.clonePackExtras`**: `none` | `previewHtml` | `zip` | `both` (default `both`)
  - **`previewHtml`** → self-contained `clone/preview.html` (screenshots + subtree + CSS + assets inlined; open offline)
  - **`zip`** → `clone.zip` next to the pick folder (and `latest/clone.zip`) with full pack + light context
- Terminal/clipboard attach includes `preview.html` / `clone.zip` paths when present

## [0.1.14] — 2026-08-07

### Added
- **Clone mode** — separate from Select: full agent-ready pack for 1:1 UI recreation
  - Command: `DaVinchi: Toggle Clone Mode` · shortcut `Ctrl+Shift+Alt+C` · purple highlight
  - Pack under `.element-picks/<ts>/clone/` (+ mirrored to `latest/clone/`)
  - Artifacts: `CLONE.md`, `AGENT.md`, `element.png`, `page.png`, `parent.png`, `subtree.html`, `styles.css`, `computed.json`, `fonts.json`, `meta.json`, `assets/*` + `manifest.json`
  - Deep capture: full subtree HTML, ancestor layout context, matched CSS + keyframes + `@font-face`, fonts, motion styles, inline SVGs, canvas snapshots (when allowed), downloadable assets
  - Terminal/clipboard attach includes clone paths and clone-oriented prompt

## [0.1.13] — 2026-08-01

### Fixed
- **Works the same for local folders and Remote SSH**: `extensionKind: ["ui", "workspace"]` so the extension host prefers your **local PC** (Chrome launches here); workspace APIs still write picks into the remote project
- Browser attach no longer forces CDP-only on Remote SSH when Chrome is available on the UI host
- Unified auto strategy: **launch system Chrome if present → else CDP**

## [0.1.12] — 2026-08-01

### Changed
- **No preset URL** — `defaultUrl` is empty; user pastes any local/external link
- CDP failure shows a short action wizard (copy Chrome script / retry)

### Fixed
- Remote SSH flow messages (local Chrome + reverse port 9222)

## [0.1.11] — 2026-08-01

### Added
- **Local Chrome via CDP** for Remote SSH: browser runs on your PC, picks still save into the SSH workspace
- Settings: `elementPicker.browserMode` (`auto` | `cdp` | `launch`), `elementPicker.cdpEndpoint`
- Commands: **Start Local Chrome (CDP)**, **Copy Local Chrome CDP Command**
- Controls tree entry for local Chrome CDP

### Changed
- On Remote SSH, `auto` mode **does not** try to spawn Chrome on the server
- Closing a CDP session leaves the user's Chrome running

## [0.1.10] — 2026-08-01

### Fixed
- Prefer discovered system Chrome/Edge paths before Playwright cache
- Auto-pin `elementPicker.browserPath` when a system browser is found
- Clearer launch errors (remote host / platform / attempts)

## [0.1.9] — 2026-08-01

### Fixed
- Launch local Chrome from Windows Local AppData / Edge paths
- Setting `elementPicker.browserPath` for manual chrome.exe path
- Default URL → `https://davinchi-crypto.com/coin_rebalancer/`

## [0.1.8] — 2026-08-01

### Added
- **Native Controls tree** in the Activity Bar (works without webview Service Worker)
- **Action menu** via status bar and `Ctrl+Shift+Alt+E`
- **Editor rich UI** panel as a separate webview lifecycle
- **Reload Webview** recovery command
- Webview remount on visibility; `retainContextWhenHidden: false`

### Why
Sidebar webviews in VS Code / Cursor can fail with  
`InvalidStateError: Failed to register a ServiceWorker`.  
Core workflow no longer depends on that surface.

## [0.1.7] — 2026-08-01

### Added
- **Canvas metrics** block: CSS box vs bitmap (`width`/`height`) vs `devicePixelRatio`, scale status for blur debugging
- `devicePixelRatio` always listed under Dimensions

## [0.1.6] — 2026-08-01

### Changed
- Activity Bar icon: precision reticle + selection corners + diamond mark

## [0.1.5] — 2026-08-01

### Added
- Matched CSS for **direct children**
- Rule **source labels** (`/* styles.css */`, media conditions)
- Recursive walk of `@media` / nested rules
- State / pseudo-class matching (e.g. `:hover`) and `::before` / `::after` computed styles
- Sibling class **variants** (e.g. `.tab.active` when picking `.tab`)
- **Compact resolved** styles (non-default only)

## [0.1.0] – [0.1.4]

### Added
- Playwright browser session (Chrome / Edge / Chromium)
- Hover highlight + click capture
- `context.md` + cropped `element.png` → `.element-picks/`
- Terminal + clipboard attach for agent chats
- Multi-language UI (18 locales)
- Side panel, status bar, keyboard shortcut `Ctrl+Shift+E`
