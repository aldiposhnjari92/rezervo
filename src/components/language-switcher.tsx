"use client";

import { useTransition } from "react";
import { Languages, Loader2 } from "lucide-react";

import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
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

type TriggerState = {
  current: Locale;
  pending: boolean;
  open: boolean;
  toggle: () => void;
};

/**
 * Menyja, e ndarë nga butoni që e hap.
 *
 * Të dy variantet — fusha te rregullimet dhe butoni te koka — kanë të njëjtin
 * panel dhe të njëjtën sjellje; ndryshon vetëm ajo që preket. Ndaj lista rri
 * këtu një herë, kurse butoni vjen si funksion.
 */
function LanguageMenu({
  className,
  panelClassName,
  children,
}: {
  className?: string;
  panelClassName?: string;
  children: (state: TriggerState) => React.ReactNode;
}) {
  const { current, pending, change } = useLanguageChange();

  return (
    <Dropdown
      className={className}
      panelClassName={panelClassName}
      trigger={({ open, toggle }) => children({ current, pending, open, toggle })}
    >
      {({ close }) =>
        LOCALES.map((locale) => (
          <DropdownItem
            key={locale}
            selected={locale === current}
            disabled={pending}
            onSelect={() => {
              close();
              change(locale);
            }}
          >
            {LOCALE_NAMES[locale]}
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}

export function LanguageSelect({ className }: { className?: string }) {
  const t = useT();

  return (
    <LanguageMenu className={className} panelClassName="left-0 right-0">
      {({ current, pending, open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={t("common.language")}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-base",
            "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm",
            open && "ring-2 ring-ring",
          )}
        >
          <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">{LOCALE_NAMES[current]}</span>
          {pending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Chevron className="shrink-0 text-muted-foreground" />
          )}
        </button>
      )}
    </LanguageMenu>
  );
}

/** Varianti kompakt për kokën — i njëjti zgjedhës, pa etiketë. */
export function LanguageToggle({ className }: { className?: string }) {
  const t = useT();

  return (
    <LanguageMenu className={className} panelClassName="right-0 w-40">
      {({ current, pending, open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={t("common.language")}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
            open && "bg-muted text-foreground",
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Languages className="h-4 w-4 shrink-0" />
          )}
          {LOCALE_NAMES[current]}
        </button>
      )}
    </LanguageMenu>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-4 w-4", className)} aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
