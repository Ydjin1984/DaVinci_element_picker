# Changelog

All notable changes to **DaVinchi** are documented in this file.

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
