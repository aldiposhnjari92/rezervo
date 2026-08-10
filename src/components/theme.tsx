"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";

import { Segmented, SegmentedButton } from "@/components/segmented";
import { useT } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/sq";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "rezervo-theme";

/**
 * Skript që ekzekutohet PARA se të pikturohet faqja.
 * Pa të, çdo ngarkim do të xixëllonte i bardhë përpara se të bëhej i errët.
 * Mbahet i shkurtër me qëllim — bllokon renderimin.
 */
export const THEME_SCRIPT = `(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}')||'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;

type ThemeContext = { theme: Theme; setTheme: (theme: Theme) => void; resolved: "light" | "dark" };

const Ctx = createContext<ThemeContext | null>(null);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Vlera reale lexohet vetëm pas montimit — serveri nuk e di dot.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    setResolved(apply(stored));
  }, []);

  // Kur tema është "system", ndiq ndryshimet e sistemit në kohë reale.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    setResolved(apply(next));
  }, []);

  return <Ctx.Provider value={{ theme, setTheme, resolved }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme duhet përdorur brenda ThemeProvider");
  return ctx;
}

const OPTIONS = [
  { value: "light", label: "theme.light", icon: Sun },
  { value: "dark", label: "theme.dark", icon: Moon },
  { value: "system", label: "theme.system", icon: Monitor },
] as const satisfies readonly { value: Theme; label: DictKey; icon: typeof Sun }[];

/**
 * Zgjedhës me tri pozicione — pa menu, pa surpriza.
 *
 * Përdor të njëjtin kontroll me segmente si periudhat te paneli, pamjet te
 * kalendari dhe skedat te rregullimet: e njëjta zgjedhje, e njëjta pamje.
 * Etiketat janë të dukshme, jo vetëm ikona — "Sistemi" nuk merret me mend.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <Segmented className={className}>
      {OPTIONS.map(({ value, label, icon }) => (
        <SegmentedButton
          key={value}
          active={theme === value}
          icon={icon}
          onClick={() => setTheme(value)}
        >
          {t(label)}
        </SegmentedButton>
      ))}
    </Segmented>
  );
}

/** Buton i vetëm që kalon mes çelët/errët — për kokën në telefon. */
export function ThemeButton({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const t = useT();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      aria-label={resolved === "dark" ? t("theme.toLight") : t("theme.toDark")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/** Toaster-i i sonner-it, i lidhur me temën aktuale. */
export function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster position="top-center" richColors closeButton theme={resolved} />;
}
