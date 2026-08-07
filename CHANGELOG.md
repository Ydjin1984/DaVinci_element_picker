# Changelog

All notable changes to **DaVinchi** are documented in this file.

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
