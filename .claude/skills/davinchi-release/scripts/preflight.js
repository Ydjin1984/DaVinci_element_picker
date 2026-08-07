#!/usr/bin/env node
/**
 * Префлайт-проверки DaVinchi Element Picker.
 * Запуск из корня расширения:  node .claude/skills/davinchi-release/scripts/preflight.js [--vsix]
 * Код выхода 0 = все проверки прошли, 1 = есть ошибки.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd();
if (!fs.existsSync(path.join(root, "src", "extension.ts"))) {
  console.error("Запускайте из корня .element_picker_extension (не найден src/extension.ts)");
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL  " + m); };
const warn = (m) => console.warn("warn  " + m);
const ok = (m) => console.log("ok    " + m);

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

function walkTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(p, acc);
    else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}
const srcFiles = walkTs(path.join(root, "src"));
const srcCorpus = srcFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

/* 1. panel.ts: inline <script> без backticks/${ и с валидным синтаксисом */
{
  const panel = read("src/ui/panel.ts");
  const blocks = [...panel.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) fail("panel.ts: не найден блок <script>");
  blocks.forEach(([, js], i) => {
    const tag = `panel.ts <script> #${i + 1}`;
    if (js.includes("`")) fail(`${tag}: backtick внутри inline-скрипта (закроет TS template literal)`);
    if (js.includes("${")) fail(`${tag}: '\${' внутри inline-скрипта (TS-интерполяция)`);
    try {
      new Function(js);
      ok(`${tag}: синтаксис валиден, backticks/\${ отсутствуют`);
    } catch (e) {
      fail(`${tag}: синтаксическая ошибка — ${e.message}`);
    }
  });
}

/* 2. Команды: contributes.commands <-> registerCommand(), keybindings */
{
  const contributed = new Set((pkg.contributes?.commands || []).map((c) => c.command));
  const registered = new Set(
    [...srcCorpus.matchAll(/registerCommand\(\s*["']([^"']+)["']/g)].map((m) => m[1])
  );
  for (const c of contributed) {
    if (!registered.has(c)) fail(`команда ${c} объявлена в package.json, но не зарегистрирована в src`);
  }
  for (const c of registered) {
    if (!contributed.has(c)) fail(`команда ${c} зарегистрирована в src, но не объявлена в contributes.commands`);
  }
  for (const kb of pkg.contributes?.keybindings || []) {
    if (!contributed.has(kb.command)) fail(`keybinding ссылается на несуществующую команду ${kb.command}`);
  }
  if (contributed.size && [...contributed].every((c) => registered.has(c))) {
    ok(`команды синхронизированы (${contributed.size} contributes ↔ ${registered.size} registerCommand)`);
  }
}

/* 3. Настройки: каждая elementPicker.* из configuration читается в src */
{
  const props = Object.keys(pkg.contributes?.configuration?.properties || {});
  let allUsed = true;
  for (const prop of props) {
    const short = prop.replace(/^elementPicker\./, "");
    if (!srcCorpus.includes(`"${short}"`) && !srcCorpus.includes(`'${short}'`)) {
      allUsed = false;
      fail(`настройка ${prop} объявлена, но её ключ "${short}" не встречается в src`);
    }
  }
  if (allUsed) ok(`все ${props.length} настроек elementPicker.* используются в src`);
}

/* 4. CHANGELOG: секция для текущей версии */
{
  const ch = read("CHANGELOG.md");
  if (ch.includes(`## [${pkg.version}]`)) ok(`CHANGELOG.md содержит секцию [${pkg.version}]`);
  else fail(`CHANGELOG.md: нет секции ## [${pkg.version}] — добавьте запись перед сборкой`);
}

/* 5. --vsix: размер пакета и мусор в vsce ls */
if (process.argv.includes("--vsix")) {
  const vsixName = `element-picker-${pkg.version}.vsix`;
  const all = fs.readdirSync(root)
    .filter((f) => /^element-picker-\d+\.\d+\.\d+\.vsix$/.test(f))
    .sort((a, b) => fs.statSync(path.join(root, a)).mtimeMs - fs.statSync(path.join(root, b)).mtimeMs);
  if (fs.existsSync(path.join(root, vsixName))) {
    const cur = fs.statSync(path.join(root, vsixName)).size;
    const prev = all.filter((f) => f !== vsixName).pop();
    if (prev) {
      const prevSize = fs.statSync(path.join(root, prev)).size;
      if (cur > prevSize * 1.5) {
        fail(`${vsixName} (${(cur / 1e6).toFixed(1)} MB) больше ${prev} (${(prevSize / 1e6).toFixed(1)} MB) в ${(cur / prevSize).toFixed(1)}× — проверьте vsce ls`);
      } else ok(`размер VSIX в норме: ${(cur / 1e6).toFixed(1)} MB (пред. ${(prevSize / 1e6).toFixed(1)} MB)`);
    }
  } else warn(`${vsixName} ещё не собран — пропускаю проверку размера`);
  try {
    const list = execSync("npx --no-install vsce ls", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const bad = list.split(/\r?\n/).filter((l) => {
      const p = l.trim().replace(/\\/g, "/");
      if (!p || p.startsWith("node_modules/playwright-core/") || p.startsWith("media/")) {
        return false;
      }
      // Private captures, agent tooling, publish scripts, nested VSIX, dump HTML
      return /^(clones\/|\.element-picks\/|\.claude\/|\.agents\/|finandy|scripts\/)/i.test(p)
        || /\.vsix$/i.test(p)
        || (/^[^/]+\.(html|png|jpg|jpeg|webp)$/i.test(p) && p !== "readme.md");
    });
    if (bad.length) fail(`в VSIX попадает мусор:\n      ${bad.slice(0, 10).join("\n      ")}`);
    else ok("vsce ls: мусорных файлов в пакете нет");
  } catch (e) {
    warn("не удалось выполнить vsce ls: " + String(e.message).split("\n")[0]);
  }
}

console.log(failures ? `\nИТОГ: ${failures} ошибок` : "\nИТОГ: все проверки пройдены");
process.exit(failures ? 1 : 0);
