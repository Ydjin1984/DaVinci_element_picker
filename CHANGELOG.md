# Changelog

All notable changes to **DaVinchi** are documented in this file.

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
