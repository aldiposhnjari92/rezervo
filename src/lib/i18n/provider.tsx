"use client";

import { createContext, useContext, useMemo } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { en } from "./en";
import { formatters, type Format } from "./format";
import { interpolate } from "./interpolate";
import { sq, type Dict } from "./sq";

/**
 * Fjalorët importohen këtu, jo të kaluar nga serveri.
 *
 * Kalimi si prop i fut të gjithë vargjet brenda ngarkesës RSC të ÇDO faqeje —
 * dhjetëra kilobajt të ridërguar në çdo navigim, mbi një rrjet ku shumica e
 * përdoruesve janë me telefon. Kështu ata bëhen pjesë e bundle-it: shkarkohen
 * një herë dhe ruhen në cache.
 *
 * (Kjo doli edhe si defekt testesh: me fjalorin brenda ngarkesës, çdo pohim i
 * llojit "faqja përmban këtë fjali" përputhej me fjalorin e jo me atë që
 * shihte vërtet përdoruesi.)
 */
const DICTS: Record<Locale, Dict> = { sq, en };

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * `t("key")` te komponentët e klientit.
 *
 * Një çelës që mungon kthen vetë çelësin: duket menjëherë në ekran, ndërsa një
 * fjali e zbrazët nuk të thotë asgjë.
 */
export function useT(): (key: keyof Dict, vars?: Record<string, string | number>) => string {
  const locale = useLocale();
  return useMemo(() => {
    const dict = DICTS[locale];
    return (key: keyof Dict, vars?: Record<string, string | number>) =>
      interpolate(dict[key] ?? String(key), vars);
  }, [locale]);
}

/** Formatuesit e datave dhe numrave, të lidhur me gjuhën aktuale. */
export function useFormat(): Format {
  const locale = useLocale();
  return useMemo(() => formatters(locale), [locale]);
}
