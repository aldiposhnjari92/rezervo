import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarDays, PlusCircle, Users } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  DistributionBars,
  EarningsChart,
  StatTile,
  StatusBreakdown,
} from "@/components/charts";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/availability";
import type { OwnerDashboard } from "@/lib/admin-types";
import { DAY_KEYS, DAY_LABELS_SHORT_SQ } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Paneli" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const { business } = await requireBusiness();
  const supabase = createClient();

  const days = RANGES.includes(Number(searchParams.days) as (typeof RANGES)[number])
    ? Number(searchParams.days)
    : 30;

  const [{ data, error }, { count: servicesCount }] = await Promise.all([
    supabase.rpc("owner_dashboard", { p_days: days }),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("is_active", true),
  ]);

  const d = data as OwnerDashboard | null;

  if (!d) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <p className="font-medium">Të dhënat nuk u ngarkuan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message ?? "Provo të rifreskosh faqen."}
        </p>
      </div>
    );
  }

  const delta =
    d.earnings_prev > 0
      ? Math.round(((d.earnings_period - d.earnings_prev) / d.earnings_prev) * 100)
      : null;

  const attendance = d.status_completed + d.status_no_show;
  const noShowRate = attendance > 0 ? (d.status_no_show / attendance) * 100 : 0;
  const repeatRate =
    d.customers_total > 0 ? Math.round((d.customers_repeat / d.customers_total) * 100) : 0;

  const weekday = DAY_KEYS.map((key, i) => ({
    label: DAY_LABELS_SHORT_SQ[key],
    value: d.by_weekday.find((w) => w.dow === i + 1)?.bookings ?? 0,
  }));

  const hours = d.by_hour.length
    ? Array.from(
        { length: Math.max(...d.by_hour.map((h) => h.hour)) - Math.min(...d.by_hour.map((h) => h.hour)) + 1 },
        (_, i) => {
          const hour = Math.min(...d.by_hour.map((h) => h.hour)) + i;
          return {
            label: `${String(hour).padStart(2, "0")}:00`,
            value: d.by_hour.find((h) => h.hour === hour)?.bookings ?? 0,
          };
        },
      )
    : [];

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------------------- koka */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Përshëndetje 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.today > 0
              ? `Ke ${d.today} rezervime sot dhe ${d.upcoming} në ditët në vijim.`
              : d.upcoming > 0
                ? `Asnjë rezervim sot. ${d.upcoming} të tjera janë në pritje.`
                : "Ende asnjë rezervim në pritje."}
          </p>
        </div>

        <div className="flex rounded-lg border border-border bg-background p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard?days=${r}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                days === r
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {`${r} ditë`}
            </Link>
          ))}
        </div>
      </div>

      {!servicesCount && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Faqja jote ende s&apos;pranon rezervime</p>
            <p className="text-sm text-muted-foreground">Shto të paktën një shërbim.</p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/services">
              <PlusCircle className="h-4 w-4" />
              Shto shërbim
            </Link>
          </Button>
        </div>
      )}

      {/* ----------------------------------------------------- numrat kryesorë */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Të ardhurat ({days} ditë)</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums">
            {formatPrice(d.earnings_period)}
          </p>
          {delta !== null && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta)}% vs periudha e kaluar
            </p>
          )}
        </div>

        <StatTile
          label={`Rezervime (${days} ditë)`}
          value={d.bookings_period}
          hint={`${d.bookings_total} gjithsej`}
        />
        <StatTile label="Në pritje" value={d.upcoming} hint={`${d.today} sot`} />
        <StatTile
          label="Humbur nga mosardhjet"
          value={formatPrice(d.lost_no_show)}
          hint={attendance > 0 ? `${noShowRate.toFixed(0)}% e klientëve` : undefined}
          tone={d.lost_no_show > 0 ? "warning" : "default"}
        />
      </div>

      {/* ------------------------------------------------------------ grafikët */}
      <EarningsChart data={d.daily} days={days} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusBreakdown
          counts={{
            confirmed: d.status_confirmed,
            completed: d.status_completed,
            no_show: d.status_no_show,
            cancelled: d.status_cancelled,
          }}
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Klientët</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {d.customers_repeat} nga {d.customers_total} kthehen sërish
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href="/customers">
                  <Users className="h-4 w-4" />
                  Shiko
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {repeatRate}%
              </span>
              <span className="text-sm text-muted-foreground">klientë të përsëritur</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(repeatRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-5">
            <h2 className="font-semibold">Shërbimet më të kërkuara</h2>
            {d.top_services.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ende pa të dhëna
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {d.top_services.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {s.bookings}×
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums font-medium">
                      {formatPrice(s.earnings)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionBars
          title="Ditët më të ngarkuara"
          subtitle="Të gjitha rezervimet, sipas ditës së javës"
          data={weekday}
        />
        <DistributionBars
          title="Oraret më të kërkuara"
          subtitle="Kur rezervojnë më shumë klientët"
          data={hours}
        />
      </div>

      <Button variant="outline" className="w-full" asChild>
        <Link href="/calendar">
          <CalendarDays className="h-4 w-4" />
          Hap kalendarin
        </Link>
      </Button>
    </div>
  );
}
