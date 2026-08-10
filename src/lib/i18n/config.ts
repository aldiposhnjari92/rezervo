/**
 * Gjuha mbahet te një cookie, jo te URL-ja.
 *
 * `/en/berberi-ilir` do të thoshte dy adresa për të njëjtin dyqan: linku që
 * pronari ka ngjitur në Instagram do të ndryshonte kuptim, dhe `/[slug]` do të
 * përplasej me prefiksin e gjuhës. Cookie-ja e lë çdo adresë të paprekur.
 */
export const LOCALES = ["sq", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Shqipja është gjuha e parë: klientët e këtyre bizneseve janë shqiptarë. */
export const DEFAULT_LOCALE: Locale = "sq";

export const LOCALE_COOKIE = "rezervo-locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  sq: "Shqip",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
