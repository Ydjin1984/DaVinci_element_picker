# Contributing to DaVinchi

Thanks for helping improve the element picker for AI agents.

## Dev setup

```powershell
npm install
npm run compile
# F5 → Extension Development Host
```

Watch mode:

```powershell
npm run watch
```

## Project map

| Path | Role |
|------|------|
| `src/browser/pickerInject.ts` | In-page highlight + CSS/HTML capture |
| `src/browser/browserSession.ts` | Playwright lifecycle |
| `src/capture/contextBuilder.ts` | `context.md` markdown |
| `src/chat/chatBridge.ts` | Terminal + clipboard |
| `src/hostInfo.ts` | Version / host badge (`ui` vs `workspace`) |
| `src/ui/*` | Controls tree, webview, status bar, menu |
| `src/i18n/*` | Locales (18 languages) |
| `src/storage/*` | Picks, clone pack, options |

## Guidelines

1. **Prefer native UI** (TreeView / QuickPick / commands) over webview for anything critical — host Service Worker bugs are real.
2. Keep capture logic in the **page inject** (`pickerInject.ts`); host only orchestrates.
3. New user-facing strings: add keys to `src/i18n/messages.ts` (`en` + all locales; others may spread `...en`).
4. Bump `package.json` version and `CHANGELOG.md` for every user-visible release.
5. Package with `npm run package` (or `package:out`) before tagging.
6. Run preflight: `node .claude/skills/davinchi-release/scripts/preflight.js`
7. Do not silently change defaults that turn off highlight/modes (see 0.1.21 lesson).

## Pull requests

- Small, focused commits.
- Describe the agent-facing benefit (what appears in `context.md` / UX).
- If you change CSS collection, note a manual smoke target (e.g. `nav.tabs`, `canvas`).

## License

By contributing, you agree your changes are under the MIT License.
