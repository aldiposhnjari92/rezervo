import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { formatters, type Format } from "./format";
import { interpolate } from "./interpolate";
import { en } from "./en";
import { sq, type Dict } from "./sq";

const DICTS: Record<Locale, Dict> = { sq, en };

/** Gjuha e kërkesës aktuale. Cookie e pavlefshme ose e munguar -> shqip. */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDict(locale: Locale = getLocale()): Dict {
  return DICTS[locale];
}

/** `t("key")` te komponentët e serverit. */
export function getT(locale: Locale = getLocale()) {
  const dict = DICTS[locale];
  return (key: keyof Dict, vars?: Record<string, string | number>) =>
    interpolate(dict[key] ?? String(key), vars);
}

export function getFormat(locale: Locale = getLocale()): Format {
  return formatters(locale);
}
