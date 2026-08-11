# DaVinchi — установка

Расширение ставится из файла **`.vsix`** (Marketplace по умолчанию не используется).

**Актуальная версия: `0.1.30`** · id `coin-rebalancer.element-picker`

---

## Требования

| | |
|--|--|
| **VS Code** 1.85+ или **Cursor** | Хост расширения |
| **Google Chrome** или **Microsoft Edge** | Окно выбора элементов |
| Открытая **папка workspace** | Сюда пишутся `.element-picks/` |

Node.js нужен только тому, кто **собирает** `.vsix` из исходников.

---

## Установка (GUI)

1. Скачайте `element-picker-0.1.30.vsix` из [Releases](https://github.com/Ydjin1984/DaVinci_element_picker/releases) или возьмите файл после локальной сборки.
2. VS Code / Cursor → `Ctrl+Shift+X` → `⋯` → **Install from VSIX…**
3. Выберите файл → **Install** → **Reload**.
4. Слева в Activity Bar — иконка **DaVinchi**.

---

## Установка (CLI)

```powershell
code --install-extension ".\element-picker-0.1.30.vsix" --force
cursor --install-extension ".\element-picker-0.1.30.vsix" --force
```

Проверка:

```powershell
code --list-extensions --show-versions | findstr element-picker
cursor --list-extensions --show-versions | findstr element-picker
```

Ожидается: `coin-rebalancer.element-picker@0.1.30`

---

## Как пользоваться

1. **File → Open Folder** — откройте проект (без workspace picks не сохранятся).
2. Иконка **DaVinchi** слева → вкладка **Controls**.
3. **Open browser** → вставьте URL.
4. **Select mode** (`Ctrl+Shift+E`) или **Clone mode** (`Ctrl+Shift+Alt+C`).
5. Наведите (подсветка) → клик по элементу.
6. Файлы:

```text
.element-picks/<timestamp>/context.md
.element-picks/<timestamp>/element.png
.element-picks/latest/...
```

7. Пути попадают в **терминал** и **буфер обмена** — допишите вопрос агенту.

В шапке панели, status bar, дереве Controls и меню виден **бейдж версии**  
(`v0.1.30 · ui|workspace · platform`) — удобно понять, на каком хосте крутится расширение.

### Горячие клавиши

| | |
|--|--|
| `Ctrl+Shift+E` | Режим Select |
| `Ctrl+Shift+Alt+C` | Режим Clone |
| `Ctrl+Shift+Alt+E` | Меню действий |

### Если вкладка UI с ошибкой Service Worker

Это ограничение хоста VS Code/Cursor, не логики pick.  
Используйте **Controls** или меню в status bar — расширение работает полностью.  
Команды: **Reload Webview UI** / **Fix Webview Cache**.

---

## Remote SSH (проект на сервере)

Ставьте VSIX в **локальный** VS Code/Cursor на своём ПК — **не** на SSH-хост. Расширение UI-only: Chrome открывается **локально**, а пики автоматически сохраняются в **удалённый** workspace на сервере. CDP и проброс портов для этого не нужны.

Проверка: бейдж в панели DaVinchi должен показывать `v… · ui · win32` (не `workspace · linux`). Если видите `workspace` — переустановите VSIX локально (GUI/CLI выше, на своём ПК) и выполните **Reload Window**.

Продвинутый fallback (CDP), только если расширение вынужденно осталось на сервере: команда **DaVinchi: Start Local Chrome (CDP)** на своём ПК (предпочитается Chrome, Edge — лишь когда Chrome не найден), затем `ssh -R 9222:127.0.0.1:9222 <host>` (или `RemoteForward 9222 localhost:9222` в `~/.ssh/config`) и снова **Open browser**.

---

## Сборка из исходников

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run package
# → element-picker-0.1.30.vsix
```

---

## Язык интерфейса

Command Palette → **DaVinchi: Select Language**  
или Settings → `elementPicker.language` (сохраняется в User settings).

Полное описание: [README.md](../README.md)
