import Link from "next/link";
import { CalendarDays, LineChart, PlusCircle, Users } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Segmented, SegmentedLink } from "@/components/segmented";
import { DistributionBars, EarningsChart, StatusBreakdown } from "@/components/charts";
import { StatTile } from "@/components/stat-tile";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/availability";
import type { OwnerDashboard } from "@/lib/admin-types";
import { DAY_KEYS, DAY_LABELS_SHORT_SQ } from "@/lib/types";
import { GettingStarted } from "./getting-started";

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
      <EmptyState
        icon={LineChart}
        title="Të dhënat nuk u ngarkuan"
        description={error?.message ?? "Provo të rifreskosh faqen."}
      />
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

  // Pa asnjë rezervim, çdo numër është zero dhe çdo grafik bosh. Në atë gjendje
  // paneli nuk informon — thjesht zë vend. Zëvendësohet me hapat që duhen bërë.
  const isNew = d.bookings_total === 0;

  if (isNew) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={business.name}
          description={
            servicesCount
              ? "Gjithçka gati. Mbetet vetëm të ndash linkun."
              : "Le ta bëjmë gati dyqanin për rezervime."
          }
        />

        <GettingStarted hasServices={Boolean(servicesCount)} slug={business.slug} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------------------- koka */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={business.name}
          description={
            d.today > 0
              ? `${d.today} rezervime sot · ${d.upcoming} në ditët në vijim.`
              : d.upcoming > 0
                ? `Asnjë rezervim sot · ${d.upcoming} në pritje.`
                : "Asnjë rezervim në pritje."
          }
        />

        <Segmented className="shrink-0">
          {RANGES.map((r) => (
            <SegmentedLink key={r} href={`/dashboard?days=${r}`} active={days === r}>
              {`${r} ditë`}
            </SegmentedLink>
          ))}
        </Segmented>
      </div>

      {!servicesCount && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
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
        <StatTile
          label={`Të ardhurat (${days} ditë)`}
          value={formatMoney(d.earnings_period)}
          trend={delta !== null ? { percent: delta, label: "vs periudha e kaluar" } : undefined}
        />

        <StatTile
          label={`Rezervime (${days} ditë)`}
          value={d.bookings_period}
          hint={`${d.bookings_total} gjithsej`}
        />
        <StatTile label="Në pritje" value={d.upcoming} hint={`${d.today} sot`} />
        <StatTile
          label="Humbur nga mosardhjet"
          value={formatMoney(d.lost_no_show)}
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
          <Card className="p-5">
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
          </Card>

          <Card className="p-5">
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
                      {formatMoney(s.earnings)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
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
