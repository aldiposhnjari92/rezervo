"use client";

import { useTransition } from "react";
import { Languages, Loader2 } from "lucide-react";

import { LOCALES, LOCALE_NAMES, isLocale, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Zgjedhësi i gjuhës.
 *
 * NGARKIM I PLOTË, jo `router.refresh()`.
 *
 * Next-i mban një cache të rrugëve në klient dhe i para-ngarkon lidhjet. Ato
 * ngarkesa janë krijuar PARA ndryshimit të gjuhës, ndaj një rifreskim i butë e
 * përditësonte vetëm faqen aktuale: shtylla anësore (komponent klienti) kalonte
 * në anglisht, kurse faqja tjetër vinte nga cache-i ende shqip. Dukej sikur
 * gjuha "kthehej mbrapsht" sapo ndryshoje faqen.
 *
 * Një ngarkim i plotë e hedh atë cache dhe çdo faqe vjen sërish nga serveri me
 * cookie-n e re. Për një veprim kaq të rrallë, kjo është e drejtë edhe si ndjesi:
 * ndryshimi i gjuhës DUHET të duket si rifillim i faqes.
 */
function useLanguageChange() {
  const [pending, startTransition] = useTransition();
  const current = useLocale();

  function change(next: Locale) {
    if (next === current || pending) return;
    startTransition(async () => {
      await setLocale(next);
      window.location.reload();
    });
  }

  return { current, pending, change };
}

export function LanguageSelect({ className }: { className?: string }) {
  const { current, pending, change } = useLanguageChange();
  const t = useT();

  return (
    <div className={cn("relative", className)}>
      <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      <select
        value={current}
        disabled={pending}
        aria-label={t("common.language")}
        onChange={(e) => {
          if (isLocale(e.target.value)) change(e.target.value);
        }}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-border bg-background",
          "pl-9 pr-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm",
        )}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chevron />}
      </span>
    </div>
  );
}

/** Varianti kompakt për kokën — i njëjti zgjedhës, pa etiketë. */
export function LanguageToggle({ className }: { className?: string }) {
  const { current, pending, change } = useLanguageChange();
  const t = useT();

  return (
    <div className={cn("relative", className)}>
      <select
        value={current}
        disabled={pending}
        aria-label={t("common.language")}
        onChange={(e) => {
          if (isLocale(e.target.value)) change(e.target.value);
        }}
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-lg bg-transparent pl-8 pr-2 text-sm font-medium",
          "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
      </span>
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
