<p align="center">
  <img src="docs/media/hero.jpg" alt="DaVinchi — Pick the element. Feed the agent." width="920" />
</p>

<h1 align="center">DaVinchi</h1>

<p align="center">
  <strong>Element Picker for VS Code &amp; Cursor</strong><br/>
  Capture a DOM element → screenshot + HTML/CSS context → feed any terminal AI agent.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-you-get">What you get</a> ·
  <a href="#features">Features</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="docs/INSTALL.ru.md">RU</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?logo=visualstudiocode&logoColor=white" alt="VS Code" />
  <img src="https://img.shields.io/badge/Cursor-supported-000000?logo=cursor&logoColor=white" alt="Cursor" />
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="MIT" />
  <img src="https://img.shields.io/badge/version-0.1.8-4fc3f7" alt="version" />
</p>

---

## Why DaVinchi?

AI agents write better UI fixes when they **see** the element — not just your description.

DaVinchi opens a real Chrome/Edge window, lets you **click any DOM node**, and produces:

| Artifact | Purpose |
|----------|---------|
| `element.png` | Cropped screenshot of the target |
| `context.md` | Selector, HTML path, outerHTML, matched CSS (+ sources), resolved styles, canvas metrics |
| Terminal + clipboard | Paths ready for Claude Code, Grok, Codex, GPT CLI… |

Agent-agnostic. No Copilot lock-in.

---

## Install

### From VSIX (recommended)

1. Download the latest **`element-picker-*.vsix`** from [Releases](https://github.com/Ydjin1984/DaVinci_element_picker/releases) (or build locally — see below).
2. **VS Code / Cursor** → Extensions (`Ctrl+Shift+X`) → `⋯` → **Install from VSIX…**
3. Reload the window.

CLI:

```powershell
code --install-extension ".\element-picker-0.1.8.vsix" --force
# or
cursor --install-extension ".\element-picker-0.1.8.vsix" --force
```

Full step-by-step (RU): [docs/INSTALL.ru.md](docs/INSTALL.ru.md)

### Requirements

- VS Code **1.85+** or Cursor  
- **Google Chrome** or **Microsoft Edge** (Playwright uses the system browser via `playwright-core`)  
- A workspace folder open (picks are saved under the project)

---

## Quick start

1. Open the **DaVinchi** icon in the Activity Bar (left).
2. Prefer the **Controls** tree (native UI — always works).
3. **Open browser** → paste **any** URL (local or external — no preset).
4. **Select mode** (or `Ctrl+Shift+E`) → hover (cyan outline) → **click** an element.
5. Files land in:

```text
.element-picks/<timestamp>/context.md
.element-picks/<timestamp>/element.png
.element-picks/latest/   → copy of the last pick
```

6. Paths are pasted into the **active terminal** and **clipboard** — add your question and send to the agent.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Toggle select mode |
| `Ctrl+Shift+Alt+E` | Native action menu (status bar too) |

---

## What you get

### Real capture (canvas chart)

<p align="center">
  <img src="docs/media/screenshot-element-canvas.png" alt="Captured chart canvas" width="860" />
</p>

### Context the agent actually needs

- **HTML Path** with ids (`div#mainChart > … > canvas`)
- **Matched CSS** with sources: `/* styles.css */`, media queries, children & variants
- **Resolved values** filtered to non-defaults
- **Canvas metrics** — CSS box vs bitmap vs `devicePixelRatio` (hi-DPI blur checklist)

Example fragment:

```markdown
Element: canvas
HTML Path: div#mainChart > … > canvas

Canvas metrics:
- CSS box: 1635×840
- bitmap (canvas.width×height): 1635×840
- devicePixelRatio: 1
- scale (bitmap/CSS): 1×1 (expected ≈ 1)
- status: ok
```

### Tabs / layout elements

<p align="center">
  <img src="docs/media/screenshot-element-tabs.png" alt="Captured navigation tabs" width="720" />
</p>

---

## Features

- **Playwright** session — Chrome / Edge / Chromium channel
- Hover highlight + one-click capture
- Rich CSS collection: sources, media, children, pseudo-states, sibling variants
- Canvas / DPR metrics for chart UIs
- Multi-language UI (18 locales)
- **Controls tree** + command palette + status bar (no Service Worker dependency)
- Optional rich webview UI + editor panel + remount recovery

---

## Commands

| Command | Description |
|---------|-------------|
| `DaVinchi: Open Panel` | Focus Controls view |
| `DaVinchi: Open Browser` | Open URL in managed browser |
| `DaVinchi: Toggle Select Mode` | `Ctrl+Shift+E` |
| `DaVinchi: Show Action Menu` | `Ctrl+Shift+Alt+E` |
| `DaVinchi: Attach Last Pick to Terminal` | Paste paths |
| `DaVinchi: Copy Last Paths to Clipboard` | Copy paths |
| `DaVinchi: Open Rich UI in Editor` | Editor webview fallback |
| `DaVinchi: Reload Webview UI` | Remount if SW stuck |
| `DaVinchi: Select Language` | UI language (User settings) |

---

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `elementPicker.language` | `en` | UI language (`ca` … `zh-TW`) |
| `elementPicker.defaultUrl` | *(empty)* | Optional preferred URL; leave empty and paste any link yourself |
| `elementPicker.browserMode` | `auto` | `auto` (launch Chrome if found, else CDP) / `launch` / `cdp` |
| `elementPicker.cdpEndpoint` | `http://127.0.0.1:9222` | Optional CDP endpoint for advanced attach |
| `extensionKind` | `ui` + `workspace` | Runs on your PC even with Remote SSH; picks save to the open workspace |
| `elementPicker.browserChannel` | `chrome` | `chrome` / `msedge` / `chromium` |
| `elementPicker.outputDir` | `.element-picks` | Save folder (workspace-relative) |
| `elementPicker.autoAttach` | `true` | Terminal + clipboard after pick |
| `elementPicker.terminalPrompt` | *(localized default)* | Prefix before paths |
| `elementPicker.maxHtmlBytes` | `100000` | outerHTML truncate size |

---

## Develop

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run compile
```

- **F5** in VS Code/Cursor → Extension Development Host  
- Package VSIX: `npm run package:out` → `dist/element-picker-<version>.vsix`

```jsonc
// Suggested .vscode/launch.json (Extension Development)
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run DaVinchi Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
    }
  ]
}
```

---

## Brand

<p align="center">
  <img src="docs/media/brand-board.jpg" alt="DaVinchi brand board" width="920" />
</p>

| | |
|--|--|
| **Name** | DaVinchi |
| **Tagline** | Pick the element. Feed the agent. |
| **Mark** | Precision reticle × selection diamond |
| **Palette** | `#0b0e14` · `#4fc3f7` · `#4f8cff` · `#dce3f0` |

Social / OG card: [docs/media/og-card.jpg](docs/media/og-card.jpg)

---

## Architecture (short)

```text
Activity Bar / Commands / Status bar
        │
        ▼
  BrowserSession (Playwright + system Chrome/Edge)
        │  inject picker · screenshot · CDP
        ▼
  contextBuilder → .element-picks/*/context.md + element.png
        │
        ▼
  ChatBridge → terminal insert + clipboard
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webview “Service Worker / invalid state” | Use **Controls** tree or **Show Action Menu** — product works without the UI tab. Optional: `DaVinchi: Reload Webview UI` |
| Browser won’t open | Install Chrome or Edge; try setting `elementPicker.browserChannel` to `msedge` |
| No files written | Open a **workspace folder** first |
| Blurry canvas capture | Check **Canvas metrics** in `context.md` (DPR / under-scaled bitmap) |

---

## License

[MIT](./LICENSE) © 2026 DaVinchi contributors

---

<p align="center">
  <sub>Built for people who vibe-code UIs with agents — and want the agent to see what they see.</sub>
</p>
