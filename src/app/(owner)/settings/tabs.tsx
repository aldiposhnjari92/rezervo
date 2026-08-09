// Pa "use client": `isSettingsTab` thirret nga faqja në server. Nëse ky modul
// do të ishte i klientit, importi do të kthente një referencë klienti — jo
// funksionin — dhe faqja do të binte me "m is not a function".
import { Building2, CalendarClock, SlidersHorizontal, UserRound } from "lucide-react";

import { Segmented, SegmentedLink } from "@/components/segmented";

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
    <Segmented scroll>
      {SETTINGS_TABS.map(({ key, label, icon }) => (
        <SegmentedLink key={key} href={`/settings?tab=${key}`} active={active === key} icon={icon}>
          {label}
        </SegmentedLink>
      ))}
    </Segmented>
  );
}
