/** Supported UI languages (BCP-47 style codes). Default: en */
export const SUPPORTED_LOCALES = [
  "ca",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt-BR",
  "ru",
  "tr",
  "vi",
  "zh-CN",
  "zh-TW",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Native labels for the language picker / settings enumDescriptions */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ca: "Català",
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  nl: "Nederlands",
  pl: "Polski",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (isLocale(value)) {
    return value;
  }
  return DEFAULT_LOCALE;
}
