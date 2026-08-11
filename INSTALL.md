# DaVinchi — Install

> **Русский:** [docs/INSTALL.ru.md](docs/INSTALL.ru.md)

Install from a **`.vsix`** (GitHub Release or local build).  
**Current version: `0.1.29`** · id `coin-rebalancer.element-picker`

---

## Requirements

| | |
|--|--|
| **VS Code** 1.85+ or **Cursor** | Extension host |
| **Chrome** or **Edge** | Element picker window |
| Open **workspace folder** | Writes `.element-picks/` |

Node.js is needed only if you **build** the VSIX from source.

---

## Install (GUI)

1. Download `element-picker-0.1.29.vsix` from [Releases](https://github.com/Ydjin1984/DaVinci_element_picker/releases) or the repo root / `dist/` after a local build.
2. Extensions (`Ctrl+Shift+X`) → `⋯` → **Install from VSIX…**
3. Choose the file → **Install** → **Reload**.

---

## Install (CLI)

```powershell
code --install-extension ".\element-picker-0.1.29.vsix" --force
cursor --install-extension ".\element-picker-0.1.29.vsix" --force
```

Verify:

```powershell
code --list-extensions --show-versions | findstr element-picker
cursor --list-extensions --show-versions | findstr element-picker
```

Expected: `coin-rebalancer.element-picker@0.1.29`

---

## First use

1. **File → Open Folder** (your project).
2. Activity Bar → **DaVinchi** → **Controls**.
3. **Open browser** → URL → **Select mode** (`Ctrl+Shift+E`) → click an element.
4. Artifacts: `.element-picks/latest/context.md` + `element.png`.

Full product docs: [README.md](./README.md)

---

## Remote SSH (project on a server)

Install the VSIX on the **local** VS Code/Cursor on your PC — **not** on the SSH host. The extension is UI-only: Chrome opens **locally**, picks save into the **remote** workspace automatically.

Check: the badge in the DaVinchi panel must show `v… · ui · win32` (not `workspace · linux`). If it shows `workspace`, reinstall the VSIX locally (GUI/CLI above, run on your PC) and **Reload Window**.

---

## Build from source

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run package
# → element-picker-0.1.29.vsix
```

Or `npm run package:out` → `dist/element-picker-0.1.29.vsix`
