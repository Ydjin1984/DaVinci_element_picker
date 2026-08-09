---
name: davinchi-release
description: Сборка, проверка и установка VS Code расширения DaVinchi Element Picker — префлайт-проверки, bump версии, CHANGELOG, компиляция, VSIX, установка в VS Code и Cursor. Use when finishing changes to the extension, or when the user says «собери», «установи», «выпусти новую версию», «сделай VSIX», «проверь расширение», build/package/install/release.
---

# DaVinchi Release

Рабочий цикл выпуска новой версии расширения. Все команды выполняются из корня
`.element_picker_extension`.

## Быстрый старт

```bash
node .claude/skills/davinchi-release/scripts/preflight.js   # проверки без сборки
npm run compile                                             # tsc типизация = часть тестов
```

## Полный релизный цикл (после любых правок кода расширения)

1. **Bump версии** — `version` в `package.json` (+0.0.1) И новая секция сверху
   `CHANGELOG.md` в формате `## [X.Y.Z] — YYYY-MM-DD` с подразделами
   `### Added / Fixed / Changed`. Без bump'а не собирать.
2. **Префлайт**: `node .claude/skills/davinchi-release/scripts/preflight.js`
   — все проверки должны быть `ok`.
3. **Компиляция**: `npm run compile` (tsc также гарантирует полноту i18n —
   `Dict = Record<MessageKey, string>` для всех 18 локалей).
4. **Пакет**: `npm run package` → `element-picker-<ver>.vsix` в корне.
5. **Контроль VSIX**: `node .claude/skills/davinchi-release/scripts/preflight.js --vsix`
   — размер против предыдущей версии и мусор в пакете (clones/, *.vsix, картинки-дампы).
6. **Установка в оба редактора** (пользователь проверяет результат сразу):
   ```powershell
   code --install-extension element-picker-<ver>.vsix --force
   cursor --install-extension element-picker-<ver>.vsix --force
   ```
7. **GitHub Release (обязательно для каждой новой версии)** — tag `vX.Y.Z` + VSIX asset:
   ```powershell
   powershell -NoProfile -File .\scripts\github-release.ps1
   ```
   Нужны `gh` (winget install GitHub.cli) и push-доступ к
   `Ydjin1984/DaVinci_element_picker`. Скрипт берёт notes из CHANGELOG и
   кладёт `element-picker-<ver>.vsix` в
   https://github.com/Ydjin1984/DaVinci_element_picker/releases
8. **Коммит + push** на `main` (когда пользователь просит «запушь» / «release»):
   ```powershell
   git add -A   # не *.vsix — они в .gitignore
   git commit -m "…"
   git push origin main
   powershell -NoProfile -File .\scripts\github-release.ps1
   ```
9. **Не коммитить** без явной просьбы — кроме случаев, когда пользователь
   явно сказал «запушь / выпусти / на GitHub».

## Правила проекта (нарушение = дефект)

- **panel.ts**: единый HTML для sidebar и editor-panel — это TS template literal;
  внутри `<script>…</script>` запрещены backticks и `${`. Префлайт это проверяет.
- **i18n**: новые UI-строки только через `src/i18n/messages.ts` — добавить ключ в
  `MessageKey`, значение в `en` и переводы во все 17 остальных локалей
  (якорь вставки — конец словаря, после `onLabel`). Все локали спредят `...en`.
- **Инъекция пикера**: при изменении поведения `src/browser/pickerInject.ts`
  поднять `PICKER_VERSION`.
- **Новые опции не должны молча выключать режимы/подсветку по умолчанию**
  (урок 0.1.21: `cloneOneShot` default=true воспринимался как поломка).
- Клики внутри `<iframe>` не перехватываются пикером — известное сознательное
  ограничение, не чинить без явной просьбы.
- Настройки клон-режима централизованы в `src/storage/cloneOptions.ts`
  (`SETTING_KEYS`); новая настройка = интерфейс + SETTING_KEYS + DEFAULTS +
  `package.json` contributes.configuration + чекбокс в panel.ts + i18n-ключи.

## Что проверяет префлайт

| Проверка | Что ловит |
|---|---|
| panel.ts `<script>` | backticks, `${`, синтаксис через `new Function` |
| commands sync | contributes.commands ↔ `registerCommand` в src, keybindings |
| settings sync | каждая настройка `elementPicker.*` реально читается в src |
| CHANGELOG | есть секция для текущей версии из package.json |
| `--vsix` | рост размера пакета >1.5×, мусорные файлы в `vsce ls` |
