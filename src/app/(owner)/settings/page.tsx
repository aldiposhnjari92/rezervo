import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { isPlatformAdmin, requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInTirane } from "@/lib/availability";
import type { Closure } from "@/lib/types";
import { AccountSection } from "./account-section";
import { BookingRules } from "./booking-rules";
import { BusinessSection } from "./business-section";
import { HoursSection } from "./hours-section";
import { SettingsTabs, isSettingsTab, type SettingsTab } from "./tabs";

export const metadata: Metadata = { title: "Rregullimet" };
export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<SettingsTab, string> = {
  biznesi: "Emri, telefoni dhe linku që u jep klientëve.",
  orari: "Kur pranon rezervime gjatë javës.",
  rregullat: "Pushimet, njoftimi minimal dhe ditët e mbyllura.",
  llogaria: "Pamja e panelit dhe llogaria jote.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { business } = await requireBusiness();
  const tab: SettingsTab = isSettingsTab(searchParams.tab) ? searchParams.tab : "biznesi";

  // Vetëm skeda e rregullave i përdor mbylljet; të tjerat nuk e paguajnë pyetjen.
  const [closures, admin] = await Promise.all([
    tab === "rregullat"
      ? createClient()
          .from("business_closures")
          .select("*")
          .eq("business_id", business.id)
          .gte("closed_on", todayInTirane())
          .order("closed_on", { ascending: true })
          .then((r) => (r.data ?? []) as Closure[])
      : Promise.resolve([] as Closure[]),
    tab === "llogaria" ? isPlatformAdmin() : Promise.resolve(false),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Rregullimet" description={DESCRIPTIONS[tab]} />

      <SettingsTabs active={tab} />

      {tab === "biznesi" && (
        <BusinessSection
          name={business.name}
          slug={business.slug}
          phone={business.phone ?? ""}
          workingHours={business.working_hours}
        />
      )}

      {tab === "orari" && (
        <HoursSection
          name={business.name}
          phone={business.phone ?? ""}
          workingHours={business.working_hours}
        />
      )}

      {tab === "rregullat" && (
        <BookingRules
          bufferMinutes={business.buffer_minutes}
          minNoticeMinutes={business.min_notice_minutes}
          bookingWindowDays={business.booking_window_days}
          breakStart={business.break_start}
          breakEnd={business.break_end}
          closures={closures}
        />
      )}

      {tab === "llogaria" && <AccountSection isAdmin={admin} />}
    </div>
  );
}
