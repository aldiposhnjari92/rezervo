import Link from "next/link";
import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tiraneInstant, todayInTirane } from "@/lib/availability";
import { isCalendarView, rangeForView, type CalendarView } from "@/lib/calendar";
import type { BookingWithService, Service } from "@/lib/types";
import { CalendarView as Calendar } from "./calendar-view";

export const metadata: Metadata = { title: "Kalendari" };
export const dynamic = "force-dynamic";

function parseDate(value: string | undefined, fallback: string): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string };
}) {
  const { business } = await requireBusiness();
  const supabase = createClient();

  const today = todayInTirane();
  const view: CalendarView = isCalendarView(searchParams.view) ? searchParams.view : "day";
  const date = parseDate(searchParams.date, today);

  const range = rangeForView(view, date);

  const [{ data: bookings }, { data: services }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, services(id, name, duration_minutes, price)")
      .eq("business_id", business.id)
      .gte("start_time", tiraneInstant(range.from, "00:00").toISOString())
      .lt("start_time", tiraneInstant(range.to, "00:00").toISOString())
      .order("start_time", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("price", { ascending: true }),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {!services?.length && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Faqja jote ende s&apos;pranon rezervime</p>
            <p className="text-sm text-muted-foreground">
              Shto të paktën një shërbim që klientët të mund të rezervojnë.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/services">
              <PlusCircle className="h-4 w-4" />
              Shto shërbim
            </Link>
          </Button>
        </div>
      )}

      <Calendar
        view={view}
        date={date}
        today={today}
        bookings={(bookings ?? []) as BookingWithService[]}
        workingHours={business.working_hours}
        services={(services ?? []) as Pick<Service, "id" | "name" | "duration_minutes" | "price">[]}
        businessName={business.name}
        businessPhone={business.phone}
      />
    </div>
  );
}
