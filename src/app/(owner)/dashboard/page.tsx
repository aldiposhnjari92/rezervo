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
import { getFormat, getT } from "@/lib/i18n";
import type { OwnerDashboard } from "@/lib/admin-types";
import { DAY_KEYS } from "@/lib/types";
import { GettingStarted } from "./getting-started";

export const metadata: Metadata = { title: "Paneli" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const supabase = createClient();
  const t = getT();
  const fmt = getFormat();

  const days = RANGES.includes(Number(searchParams.days) as (typeof RANGES)[number])
    ? Number(searchParams.days)
    : 30;

  // `owner_dashboard` shkon vetë te biznesi i përdoruesit të kyçur, ndaj nuk
  // pret dot rreshtin e biznesit — të dyja nisen njëkohësisht.
  const [{ business }, { data, error }] = await Promise.all([
    requireBusiness(),
    supabase.rpc("owner_dashboard", { p_days: days }),
  ]);

  const d = data as OwnerDashboard | null;
  const servicesCount = d?.services_active ?? 0;

  if (!d) {
    return (
      <EmptyState
        icon={LineChart}
        title={t("dashboard.loadFailed")}
        description={error?.message ?? t("dashboard.loadFailedBody")}
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
    label: fmt.dayShort(key),
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
            servicesCount ? t("dashboard.readyToShare") : t("dashboard.setupPrompt")
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
              ? t("dashboard.today", { count: d.today, upcoming: d.upcoming })
              : d.upcoming > 0
                ? t("dashboard.noneToday", { upcoming: d.upcoming })
                : t("dashboard.noneAtAll")
          }
        />

        <Segmented className="shrink-0">
          {RANGES.map((r) => (
            <SegmentedLink key={r} href={`/dashboard?days=${r}`} active={days === r}>
              {t("dashboard.range", { days: r })}
            </SegmentedLink>
          ))}
        </Segmented>
      </div>

      {!servicesCount && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("dashboard.noServicesTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.noServicesBody")}</p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/services">
              <PlusCircle className="h-4 w-4" />
              {t("calendar.addService")}
            </Link>
          </Button>
        </div>
      )}

      {/* ----------------------------------------------------- numrat kryesorë */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("dashboard.earnings", { days })}
          value={fmt.money(d.earnings_period)}
          trend={delta !== null ? { percent: delta, label: t("dashboard.vsPrevious") } : undefined}
        />

        <StatTile
          label={t("dashboard.bookings", { days })}
          value={d.bookings_period}
          hint={t("dashboard.bookingsHint", { total: d.bookings_total })}
        />
        <StatTile
          label={t("dashboard.upcoming")}
          value={d.upcoming}
          hint={t("dashboard.upcomingHint", { count: d.today })}
        />
        <StatTile
          label={t("dashboard.lostToNoShows")}
          value={fmt.money(d.lost_no_show)}
          hint={attendance > 0 ? t("dashboard.lostHint", { percent: noShowRate.toFixed(0) }) : undefined}
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
                <h2 className="font-semibold">{t("dashboard.customers")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("dashboard.customersReturn", { repeat: d.customers_repeat, total: d.customers_total })}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href="/customers">
                  <Users className="h-4 w-4" />
                  {t("dashboard.view")}
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {repeatRate}%
              </span>
              <span className="text-sm text-muted-foreground">{t("dashboard.repeatRate")}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(repeatRate, 100)}%` }}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">{t("dashboard.topServices")}</h2>
            {d.top_services.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.noData")}
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
                      {fmt.money(s.earnings)}
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
          title={t("dashboard.busiestDays")}
          subtitle={t("dashboard.busiestDaysHint")}
          data={weekday}
        />
        <DistributionBars
          title={t("dashboard.busiestHours")}
          subtitle={t("dashboard.busiestHoursHint")}
          data={hours}
        />
      </div>

      <Button variant="outline" className="w-full" asChild>
        <Link href="/calendar">
          <CalendarDays className="h-4 w-4" />
          {t("dashboard.openCalendar")}
        </Link>
      </Button>
    </div>
  );
}
