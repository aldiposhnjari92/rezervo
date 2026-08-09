import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInTirane } from "@/lib/availability";
import type { Closure } from "@/lib/types";
import { BookingRules } from "./booking-rules";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Rregullimet" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { business } = await requireBusiness();
  const supabase = createClient();

  const { data: closures } = await supabase
    .from("business_closures")
    .select("*")
    .eq("business_id", business.id)
    .gte("closed_on", todayInTirane())
    .order("closed_on", { ascending: true });

  return (
    <SettingsForm
      name={business.name}
      slug={business.slug}
      phone={business.phone ?? ""}
      workingHours={business.working_hours}
    >
      <BookingRules
        bufferMinutes={business.buffer_minutes}
        minNoticeMinutes={business.min_notice_minutes}
        bookingWindowDays={business.booking_window_days}
        breakStart={business.break_start}
        breakEnd={business.break_end}
        closures={(closures ?? []) as Closure[]}
      />
    </SettingsForm>
  );
}
