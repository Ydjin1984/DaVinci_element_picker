import * as vscode from "vscode";
import {
  DEFAULT_LOCALE,
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type Locale,
} from "./locales";
import { MESSAGES, formatMessage, type MessageKey } from "./messages";

export {
  DEFAULT_LOCALE,
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type Locale,
};
export type { MessageKey };

const CONFIG_SECTION = "elementPicker";
const CONFIG_KEY = "language";

/** Current locale from user/workspace settings (default en). */
export function getLocale(): Locale {
  const raw = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>(CONFIG_KEY, DEFAULT_LOCALE);
  return normalizeLocale(raw);
}

/** Translate a key with optional {0} {1} placeholders. */
export function t(key: MessageKey, ...args: Array<string | number>): string {
  const locale = getLocale();
  const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE][key];
  const template = dict[key] ?? fallback ?? key;
  return formatMessage(template, ...args);
}

/** Full UI string map for the current locale (for webview). */
export function getUiStrings(): Record<MessageKey, string> {
  const locale = getLocale();
  const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  return { ...MESSAGES[DEFAULT_LOCALE], ...dict };
}

/**
 * Save language to **User** settings so it persists across workspaces.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const next = normalizeLocale(locale);
  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update(CONFIG_KEY, next, vscode.ConfigurationTarget.Global);
}

export function onDidChangeLanguage(
  listener: (locale: Locale) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(`${CONFIG_SECTION}.${CONFIG_KEY}`)) {
      listener(getLocale());
    }
  });
}

/** QuickPick: choose language and save to user settings. */
export async function pickAndSaveLanguage(): Promise<Locale | undefined> {
  const current = getLocale();
  const items = SUPPORTED_LOCALES.map((code) => ({
    label: LOCALE_NATIVE_NAMES[code],
    description: code,
    detail: code === current ? "✓ current / текущий" : undefined,
    locale: code,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: t("cmdSelectLanguage"),
    placeHolder: t("languagePickPlaceholder"),
    matchOnDescription: true,
  });

  if (!picked) {
    return undefined;
  }

  await setLocale(picked.locale);
  return picked.locale;
}

/** Options for language &lt;select&gt; in the side panel. */
export function getLanguageOptions(): Array<{ code: Locale; label: string }> {
  return SUPPORTED_LOCALES.map((code) => ({
    code,
    label: `${LOCALE_NATIVE_NAMES[code]} (${code})`,
  }));
}
