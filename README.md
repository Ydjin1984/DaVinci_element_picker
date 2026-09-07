<p align="center">
  <img src="media/hero.jpg" alt="DaVinchi — Pick the element. Feed the agent." width="920" />
</p>

<h1 align="center">DaVinchi</h1>

<p align="center">
  <strong>Пикер DOM-элементов для VS Code и Cursor</strong><br />
  Клик по элементу → скриншот + HTML/CSS-контекст → любому терминальному ИИ-агенту.
</p>

<p align="center">
  [English](README.en.md)
  ·
  <a href="#установка">Установка</a>
  ·
  <a href="#быстрый-старт">Быстрый старт</a>
  ·
  <a href="#работа-на-удалённом-сервере">Удалённый сервер</a>
  ·
  <a href="#настройки">Настройки</a>
  ·
  <a href="#решение-проблем">Решение проблем</a>
  ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.32-4fc3f7" alt="version 0.1.32" />
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?logo=visualstudiocode&logoColor=white" alt="VS Code 1.85+" />
  <img src="https://img.shields.io/badge/Cursor-supported-000000?logo=cursor&logoColor=white" alt="Cursor" />
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="MIT" />
</p>

---

## Зачем нужен DaVinchi?

ИИ-агенты чинят интерфейсы лучше, когда **видят** элемент, а не только его описание.

DaVinchi открывает настоящее окно Google Chrome, позволяет кликнуть любой DOM-узел и готовит готовые к вставке артефакты для Claude Code, агентов Cursor, Codex и других терминальных инструментов.

| Артефакт | Что внутри |
|----------|------------|
| `element.png` | Обрезанный скриншот цели |
| `context.md` | Селектор, HTML-путь, outerHTML, подходящие CSS, вычисленные стили, метрики canvas |
| Терминал + буфер обмена | Пути, готовые для `@mention` или вставки любому агенту |

Без привязки к Copilot. Агент-агностик.

---

## Установка

Скачайте **`element-picker-0.1.32.vsix`** из [последнего релиза](https://github.com/Ydjin1984/DaVinci_element_picker/releases/latest) и установите **на своём компьютере**:

```powershell
code --install-extension element-picker-0.1.32.vsix --force
# Cursor:
cursor --install-extension element-picker-0.1.32.vsix --force
```

Или через интерфейс: Расширения (`Ctrl+Shift+X`) → `⋯` → **Install from VSIX…** → перезагрузить окно.

### Требования

- VS Code **1.85+** или Cursor
- **Google Chrome**
- Открытая **папка рабочего пространства** — выборки сохраняются внутри проекта

> **Куда устанавливать.** Ставьте DaVinchi на машину, **за которой сидите**. На ней браузер, и именно им управляет пикер. Это работает, даже если проект живёт на SSH-сервере: расширение всё равно сохраняет выборки в серверный проект. См. [Работа на удалённом сервере](#работа-на-удалённом-сервере), если хотите запускать расширение на самом сервере.

---

## Быстрый старт

1. Откройте иконку **DaVinchi** в Activity Bar и представление **Controls**.
2. **Open browser** → вставьте любой URL.
3. Режим **Select** (`Ctrl+Shift+E`) → наведите → кликните элемент.
   Или режим **Clone** (`Ctrl+Shift+Alt+C`) для полного пакета (HTML/CSS/ресурсы).
4. Файлы появятся в проекте:

```text
.element-picks/<timestamp>/context.md
.element-picks/<timestamp>/element.png
.element-picks/latest/          → последняя выборка (или clone-пакет)
```

5. Пути вставляются в активный терминал и буфер обмена — добавьте свой вопрос и отправьте агенту.

| Горячая клавиша | Действие |
|----------|--------|
| `Ctrl+Shift+E` | Переключить режим Select |
| `Ctrl+Shift+Alt+C` | Переключить режим Clone |
| `Ctrl+Shift+Alt+E` | Меню действий (также в строке состояния) |

Панель, строка состояния, дерево Controls и меню действий показывают **бейдж версии** вида `v0.1.32 · ui · win32`. Средняя часть говорит, где запущено расширение: `ui` = ваша машина, `workspace` = SSH-сервер.

---

## Что вы получаете

### Реальная съёмка (canvas-графики)

<p align="center">
  <img src="media/screenshot-element-canvas.png" alt="Захваченный canvas графика" width="860" />
</p>

### Контекст, который реально нужен агенту

- **HTML-путь** с id (`div#mainChart > … > canvas`)
- **Подходящие CSS** с источниками, media-запросами, детьми и вариантами
- **Вычисленные значения**, отфильтрованные по не-дефолтным
- **Метрики canvas** — CSS-бокс против bitmap и `devicePixelRatio`

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

### Вкладки / элементы layout

<p align="center">
  <img src="media/screenshot-element-tabs.png" alt="Захваченные вкладки навигации" width="720" />
</p>

---

## Работа на удалённом сервере

Проект на SSH-хосте, но браузер должен быть на вашем экране. Две схемы — обе сохраняют выборки в серверный проект. Выберите одну.

### A. Расширение на вашей машине — рекомендовано, ничего настраивать не нужно

Установите VSIX **локально** (команда выше — на своём ПК, не в SSH-окне). Откройте удалённую папку как обычно; бейдж показывает `ui`. Нажмите **Open browser** — Chrome запустится прямо на вашем рабочем столе. Выборки пишутся в удалённый проект через файловый API редактора.

Больше ничего не нужно: ни туннелей, ни портов, ни лишних процессов.

> Если бейдж показывает `workspace · linux` — расширение установлено на сервере. Либо удалите его там (Extensions → запись под «SSH: … — Installed» → Uninstall), либо перейдите к схеме B.

### B. Расширение на сервере — одна команда для подготовки вашего ПК

Выбирайте, когда расширение должно жить на SSH-хосте. Оно не может запустить браузер на вашей машине напрямую, поэтому управляет браузером через debug-порт, который SSH пробрасывает к вам.

**Шаг 1 — на сервере:** установите VSIX в SSH-окне (Extensions → Install from VSIX) или с вашего ПК:

```powershell
code --remote ssh-remote+<host> --install-extension element-picker-0.1.32.vsix --force
```

**Шаг 2 — на вашем ПК (Windows), одна команда:**

```powershell
# из клонированного репозитория
.\scripts\setup-windows-cdp.ps1 -SshHost <host>

# или без клонирования
iwr -useb https://raw.githubusercontent.com/Ydjin1984/DaVinci_element_picker/master/scripts/setup-windows-cdp.ps1 -OutFile "$env:TEMP\davinchi-setup.ps1"
& "$env:TEMP\davinchi-setup.ps1" -SshHost <host>
```

Права администратора не нужны. Скрипт настраивает:

| Что | Зачем |
|-----|-------|
| `%LOCALAPPDATA%\DaVinchi\start-chrome-cdp.cmd` | запускает Chrome с `--remote-debugging-port=9222` в **отдельном профиле** — с Chrome 136 debug-порт не работает на обычном профиле |
| Автозапуск | Chrome готов сразу после входа в систему |
| Планировщик `DaVinchi Chrome CDP` | возвращает Chrome в течение 2 минут, если его закрыли |
| URI-обработчик `davinchi-chrome:` | позволяет **Open browser** на сервере запускать этот Chrome на вашем ПК |
| `RemoteForward 9222` в `~/.ssh/config` | сервер достаёт ваш debug-порт (добавляется для указанного хоста) |

**Шаг 3:** переподключите SSH-окно. Туннель создаётся при установке соединения, поэтому перезагрузки окна недостаточно.

Затем нажмите **Open browser**. Если Chrome не запущен, расширение попросит вашу машину запустить его и подождёт.

Полный откат: `.\scripts\setup-windows-cdp.ps1 -Uninstall`.

Клиенты macOS/Linux: вспомогательный скрипт пока только для Windows, но механизм переносим — запустите Chrome с `--remote-debugging-port=9222 --user-data-dir=<отдельная папка>` и добавьте `RemoteForward 9222 localhost:9222` в `~/.ssh/config`.

---

## Возможности

- Сессия Playwright — Google Chrome / Chromium
- Подсветка при наведении и захват в один клик
- Режимы **Select** и **Clone** (clone-пакет с детальными настройками)
- Богатый сбор CSS: источники, media-запросы, дети, псевдосостояния
- Метрики canvas / DPR для UI с графиками
- Многоязычный интерфейс (18 локалей)
- Бейдж версии в панели, строке состояния, Controls и меню действий
- Дерево Controls + палитра команд + строка состояния (без зависимости от Service Worker)
- Опциональный rich-webview UI, панель редактора и команда починки кэша

---

## Команды

| Команда | Описание |
|---------|----------|
| `DaVinchi: Open Panel` | Фокус на представление Controls |
| `DaVinchi: Open Browser` | Открыть URL в управляемом браузере |
| `DaVinchi: Toggle Select Mode` | `Ctrl+Shift+E` |
| `DaVinchi: Toggle Clone Mode` | `Ctrl+Shift+Alt+C` |
| `DaVinchi: Show Action Menu` | `Ctrl+Shift+Alt+E` |
| `DaVinchi: Attach Last Pick to Terminal` | Вставить пути в активный терминал |
| `DaVinchi: Copy Last Paths to Clipboard` | Скопировать блок путей |
| `DaVinchi: Reveal Last Pick Folder` | Открыть папку последнего захвата |
| `DaVinchi: Close Browser` | Отключить/закрыть управляемую сессию |
| `DaVinchi: Open Rich UI in Editor` | Webview-панель в редакторе |
| `DaVinchi: Reload Webview UI` | Перемонтировать, если webview завис |
| `DaVinchi: Fix Webview Cache` | Починить кэш Service Worker (Windows) |
| `DaVinchi: Select Language` | Язык интерфейса (сохраняется в User settings) |
| `DaVinchi: Start Local Chrome (CDP)` | Запустить Chrome с debug-портом |
| `DaVinchi: Copy Local Chrome CDP Command` | Скопировать команду запуска в буфер |

---

## Настройки

| Настройка | По умолчанию | Значение |
|-----------|--------------|----------|
| `elementPicker.language` | `en` | Язык интерфейса, 18 локалей |
| `elementPicker.defaultUrl` | *(пусто)* | Предпочтительный URL |
| `elementPicker.outputDir` | `.element-picks` | Папка сохранения (относительно workspace) |
| `elementPicker.autoAttach` | `true` | Терминал + буфер после каждой выборки |
| `elementPicker.maxHtmlBytes` | `100000` | Лимит усечения `outerHTML` в `context.md` |
| `elementPicker.browserMode` | `auto` | `auto` / `launch` / `cdp` |
| `elementPicker.cdpEndpoint` | `http://localhost:9222` | Debug-эндпоинт. Chrome отвечает на `localhost`, **не** на `127.0.0.1` |
| `elementPicker.browserChannel` | `chrome` | `chrome` / `chromium` |
| `elementPicker.browserPath` | *(пусто)* | Полный путь к `chrome.exe`/`google-chrome`, если автоопределение не сработало |
| `elementPicker.cloneZip` | `false` | Писать `clone.zip` |
| `elementPicker.cloneLatest` | `true` | Зеркалить пакет в `latest/` |
| `elementPicker.clonePreviewHtml` | `true` | Самодостаточный `clone/preview.html` |
| `elementPicker.cloneAssets` | `true` | Скачивать изображения/шрифты/иконки |
| `elementPicker.clonePageScreenshot` | `true` | Полностраничный `page.png` |
| `elementPicker.cloneParentScreenshot` | `true` | Скриншот родительской области `parent.png` |
| `elementPicker.cloneComputedJson` | `true` | `computed.json` + `fonts.json` |
| `elementPicker.cloneInlineSvgs` | `true` | Писать инлайновые SVG-файлы |
| `elementPicker.cloneFullSite` | `false` | Захват всей страницы при любом клике |
| `elementPicker.cloneOneShot` | `false` | Выход из Clone-режима после одного захвата |

Настройки браузера — уровня приложения, поэтому рабочее пространство не может указать расширению свой исполняемый файл. Все переключатели `clone*` также доступны в секции **Clone settings** панели.

---

## Решение проблем

**Бейдж показывает `workspace · linux`, и Open browser не работает.** Расширение запущено на SSH-сервере. Либо установите его на свою машину (схема A), либо подготовьте ПК скриптом `scripts/setup-windows-cdp.ps1` (схема B).

**«local Chrome is not reachable at http://localhost:9222».** Debug-Chrome не запущен или нет туннеля. Проверьте из SSH-терминала: `curl -s http://localhost:9222/json/version` должен выдать JSON с полем `Browser`. Если нет — запустите лаунчер на ПК и переподключите SSH-окно.

**Debug-порт не отвечает, хотя Chrome открыт.** Обычное окно Chrome не подойдёт — с Chrome 136 debug-порт не работает на профиле по умолчанию. Используйте лаунчер, который запускает Chrome с отдельным профилем.

**Chrome постоянно закрывается.** Сторожевой процесс возвращает его в течение двух минут. Закрытие последней вкладки закрывает окно — держите открытой вкладку `about:blank`.

**Клики внутри `<iframe>` не захватываются.** Известное и намеренное ограничение: пикер внедряется только в главный фрейм.

**Webview-панель показывает ошибку Service Worker.** Это ограничение редактора, а не пикера. Используйте представление **Controls** или меню в строке состояния; команды **Reload Webview UI** и **Fix Webview Cache** чинят это.

---

## Разработка

```powershell
git clone https://github.com/Ydjin1984/DaVinci_element_picker.git
cd DaVinci_element_picker
npm install
npm run compile
```

- **F5** → Extension Development Host
- `npm run package` → `element-picker-0.1.32.vsix`
- Предварительные проверки: `node .claude/skills/davinchi-release/scripts/preflight.js`

Вклад: [CONTRIBUTING.md](CONTRIBUTING.md) · Лицензия: [MIT](LICENSE)
