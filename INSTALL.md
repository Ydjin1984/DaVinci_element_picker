# DaVinchi — Install

> **Русская версия:** [docs/INSTALL.ru.md](docs/INSTALL.ru.md) · Full documentation: [README.md](./README.md)

**Current version: `0.1.32`** · id `coin-rebalancer.element-picker`

---

## 1. Install

Download `element-picker-0.1.32.vsix` from the [latest release](https://github.com/Ydjin1984/DaVinci_element_picker/releases/latest) and run it **on your own computer**:

```powershell
code --install-extension element-picker-0.1.32.vsix --force
cursor --install-extension element-picker-0.1.32.vsix --force
```

Or: Extensions (`Ctrl+Shift+X`) → `⋯` → **Install from VSIX…** → reload the window.

Verify:

```powershell
code --list-extensions --show-versions | findstr element-picker
# expected: coin-rebalancer.element-picker@0.1.32
```

Requirements: VS Code 1.85+ or Cursor · Google Chrome · an open workspace folder.

---

## 2. First pick

1. **File → Open Folder** — your project.
2. Activity Bar → **DaVinchi** → **Controls**.
3. **Open browser** → paste a URL → **Select mode** (`Ctrl+Shift+E`) → click an element.
4. Artifacts: `.element-picks/latest/context.md` and `element.png`; the paths also land in the terminal and clipboard.

---

## 3. Project on an SSH server

Install DaVinchi on **your own machine**, then open the remote folder as usual. Chrome starts on your desktop, and picks are saved into the project on the server. The version badge in the panel must read `ui` (your machine), not `workspace` (the server).

Want the extension itself to live on the server? Install it there, then prepare your PC with one command:

```powershell
.\scripts\setup-windows-cdp.ps1 -SshHost <host>
```

and reconnect the SSH window. Details and the macOS/Linux equivalent: [README — Working on a remote server](./README.md#working-on-a-remote-server).

---

## 4. Build from source

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run package     # → element-picker-0.1.32.vsix
```
