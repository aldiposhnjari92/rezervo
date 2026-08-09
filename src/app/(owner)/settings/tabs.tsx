// Pa "use client": `isSettingsTab` thirret nga faqja në server. Nëse ky modul
// do të ishte i klientit, importi do të kthente një referencë klienti — jo
// funksionin — dhe faqja do të binte me "m is not a function".
// Skedat janë vetëm lidhje; nuk u duhet asnjë hook.
import Link from "next/link";
import { Building2, CalendarClock, SlidersHorizontal, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { key: "biznesi", label: "Biznesi", icon: Building2 },
  { key: "orari", label: "Orari", icon: CalendarClock },
  { key: "rregullat", label: "Rregullat", icon: SlidersHorizontal },
  { key: "llogaria", label: "Llogaria", icon: UserRound },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

export function isSettingsTab(value: unknown): value is SettingsTab {
  return SETTINGS_TABS.some((t) => t.key === value);
}

/**
 * Ndarja në skeda nuk është vetëm kozmetike.
 *
 * Më parë kjo faqe ishte gjashtë kartela njëra poshtë tjetrës me DY butona
 * "Ruaj" — një pluskues në fund që ruante emrin dhe orarin, dhe një tjetër
 * brenda kartelës së rregullave. Nuk ishte e qartë se cili ruante çfarë.
 * Tani çdo skedë ka fushat e veta dhe një buton të vetëm ruajtjeje.
 *
 * Gjendja mbahet te URL-ja, që skeda të mos humbasë pas ruajtjes.
 */
export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0">
      <nav className="flex w-max gap-1 rounded-xl border border-border bg-card p-1 lg:w-auto">
        {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/settings?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active === key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
