"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";

import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Zgjedhësi i gjuhës.
 *
 * `router.refresh()` pas veprimit: teksti i faqeve të serverit është pjesë e
 * përgjigjes, ndaj pa një rivizatim gjuha do të ndryshonte vetëm te pjesët e
 * klientit dhe faqja do të mbetej gjysmë shqip.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  function pick(locale: Locale) {
    if (locale === current || pending) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("common.language")}
      className={cn("flex gap-1 rounded-xl border border-border bg-background p-1", className)}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          role="radio"
          aria-checked={current === locale}
          disabled={pending}
          onClick={() => pick(locale)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5",
            "text-sm font-medium transition-colors disabled:opacity-60",
            current === locale
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {current === locale && <Check className="h-3.5 w-3.5 shrink-0" />}
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}

/** Varianti kompakt për kokën e faqeve publike. */
export function LanguageToggle({ className }: { className?: string }) {
  const router = useRouter();
  const current = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const next: Locale = current === "sq" ? "en" : "sq";

  return (
    <button
      type="button"
      disabled={pending}
      title={t("common.language")}
      aria-label={`${t("common.language")}: ${LOCALE_NAMES[next]}`}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className="uppercase">{next}</span>
    </button>
  );
}
