# DaVinchi — установка (RU)

Расширение **не** публикуется в Marketplace по умолчанию. Ставится из файла **`.vsix`**.

## Требования

| | |
|--|--|
| **VS Code** 1.85+ или **Cursor** | Хост расширения |
| **Google Chrome** или **Microsoft Edge** | Окно выбора элементов (Playwright) |
| Открытая **папка workspace** | Сюда пишутся `.element-picks/` |

Node.js нужен только тому, кто **собирает** `.vsix` из исходников.

---

## Вариант A — GUI

1. Скачайте `element-picker-0.1.8.vsix` из **Releases** (или `dist/` после сборки).
2. VS Code / Cursor → `Ctrl+Shift+X` → `⋯` → **Install from VSIX…**
3. Выберите файл → **Install** → **Reload**.
4. Слева в Activity Bar — иконка **DaVinchi** (прицел).

---

## Вариант B — CLI

```powershell
code --install-extension "C:\path\to\element-picker-0.1.8.vsix" --force
# или
cursor --install-extension "C:\path\to\element-picker-0.1.8.vsix" --force
```

Проверка:

```powershell
code --list-extensions --show-versions | findstr element-picker
cursor --list-extensions --show-versions | findstr element-picker
```

Ожидается: `coin-rebalancer.element-picker@0.1.8` (или актуальная версия).

---

## Как пользоваться

1. **File → Open Folder** — откройте проект (без workspace picks не сохранятся).
2. Иконка **DaVinchi** слева → вкладка **Controls** (нативное дерево, без webview).
3. **Open browser** → URL (например `http://localhost:8090/`).
4. **Select mode** или `Ctrl+Shift+E`.
5. Наведите (подсветка) → клик по элементу.
6. Файлы:

```text
.element-picks/<timestamp>/context.md
.element-picks/<timestamp>/element.png
.element-picks/latest/...
```

7. Пути вставляются в **терминал** и **буфер обмена** — допишите вопрос агенту.

### Горячие клавиши

| | |
|--|--|
| `Ctrl+Shift+E` | Режим выбора |
| `Ctrl+Shift+Alt+E` | Меню действий |

### Если вкладка UI с ошибкой Service Worker

Это баг хоста VS Code/Cursor, **не** логики pick.  
Используйте **Controls** или меню в status bar — расширение работает полностью.

---

## Сборка из исходников

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run package:out
# → dist/element-picker-<version>.vsix
```

---

## Язык интерфейса

Command Palette → **DaVinchi: Select Language**  
или Settings → `elementPicker.language` (сохраняется в User settings).
