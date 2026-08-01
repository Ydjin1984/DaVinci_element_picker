# DaVinchi — install

> **Русский:** [docs/INSTALL.ru.md](docs/INSTALL.ru.md)

Install from a **`.vsix`** (GitHub Release or local `dist/`).

## Requirements

- **VS Code** 1.85+ or **Cursor**
- **Chrome** or **Edge**
- An open **workspace folder**

## Install (GUI)

1. Download `element-picker-0.1.8.vsix` (or newer) from Releases / `dist/`.
2. Extensions → `⋯` → **Install from VSIX…**
3. Reload.

## Install (CLI)

```powershell
code --install-extension ".\element-picker-0.1.8.vsix" --force
cursor --install-extension ".\element-picker-0.1.8.vsix" --force
```

Extension id: `coin-rebalancer.element-picker`

## First use

1. File → Open Folder (your project).
2. Activity Bar → **DaVinchi** → **Controls**.
3. Open browser → Select mode (`Ctrl+Shift+E`) → click an element.
4. Artifacts: `.element-picks/latest/context.md` + `element.png`.

Full docs: [README.md](./README.md)

## Build from source

```powershell
npm install
npm run package:out
# → dist/element-picker-<version>.vsix
```
