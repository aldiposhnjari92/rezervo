import Link from "next/link";
import { Ban, ChevronRight, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BookingsChart, StatusBreakdown } from "@/components/charts";
import { StatTile } from "@/components/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { getFormat, getT } from "@/lib/i18n";
import type {
  AdminBusinessRow,
  AdminOverview,
  DailyBookings,
  OrphanAccount,
} from "@/lib/admin-types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const t = getT();
  const fmt = getFormat();

  const [overviewRes, dailyRes, businessesRes, orphansRes] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_daily_bookings", { p_days: 30 }),
    supabase.rpc("admin_businesses"),
    supabase.rpc("admin_orphan_accounts"),
  ]);

  const overview = overviewRes.data as AdminOverview | null;
  const daily = (dailyRes.data ?? []) as DailyBookings[];
  const businesses = (businessesRes.data ?? []) as AdminBusinessRow[];
  const orphans = (orphansRes.data ?? []) as OrphanAccount[];

  if (!overview) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title={t("admin.loadFailed")}
        description={overviewRes.error?.message ?? t("dashboard.loadFailedBody")}
      />
    );
  }

  const activationRate =
    overview.users_total > 0
      ? Math.round((overview.businesses_total / overview.users_total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.subtitle")}
      />

      {/* ------------------------------------------------------- numrat kryesorë */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("admin.businesses")}
          value={overview.businesses_total}
          hint={t("admin.newThisMonth", { count: overview.businesses_new_30d })}
        />
        <StatTile
          label={t("admin.accounts")}
          value={overview.users_total}
          hint={t("admin.activationRate", { percent: activationRate })}
        />
        <StatTile
          label={t("admin.bookings")}
          value={overview.bookings_total}
          hint={t("admin.last30", { count: fmt.number(overview.bookings_30d) })}
        />
        <StatTile
          label={t("admin.gmv")}
          value={fmt.money(overview.gmv_total)}
          hint={t("admin.last30", { count: fmt.money(overview.gmv_30d) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("admin.active30")}
          value={overview.businesses_active_30d}
          hint={t("admin.active30Hint")}
        />
        <StatTile label={t("admin.upcoming")} value={overview.bookings_upcoming} />
        <StatTile label={t("admin.services")} value={overview.services_total} />
        <StatTile
          label={t("admin.suspended")}
          value={overview.businesses_suspended}
          tone={overview.businesses_suspended > 0 ? "warning" : "default"}
        />
      </div>

      {/* ---------------------------------------------------------------- grafikët */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <BookingsChart data={daily} />
        <StatusBreakdown
          counts={{
            confirmed: overview.status_confirmed,
            completed: overview.status_completed,
            no_show: overview.status_no_show,
            cancelled: overview.status_cancelled,
          }}
        />
      </div>

      {/* ---------------------------------------------------------------- bizneset */}
      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold">{t("admin.businessList")}</h2>
          <span className="text-sm text-muted-foreground">{businesses.length}</span>
        </div>

        {businesses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t("admin.noBusinesses")}
          </p>
        ) : (
          <>
            {/* tabelë në desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">{t("admin.colBusiness")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("admin.colOwner")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("admin.colServices")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("admin.colBookings")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("admin.col30d")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("admin.colNoShows")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("admin.colValue")}</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr
                      key={b.business_id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/40",
                        b.suspended_at && "bg-amber-500/10",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{b.name}</span>
                          {b.suspended_at && (
                            <Badge variant="warning" className="gap-1">
                              <Ban className="h-3 w-3" />
                              {t("admin.suspendedBadge")}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">/{b.slug}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-muted-foreground">{b.owner_email}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{b.services_count}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{b.bookings_total}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{b.bookings_30d}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {b.no_shows > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400">{b.no_shows}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt.money(b.gmv)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/${b.owner_id}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {t("common.open")}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* kartela në mobile */}
            <div className="divide-y divide-border lg:hidden">
              {businesses.map((b) => (
                <Link
                  key={b.business_id}
                  href={`/admin/${b.owner_id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{b.name}</p>
                      {b.suspended_at && (
                        <Badge variant="warning" className="shrink-0">
                          {t("admin.suspendedBadge")}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{b.owner_email}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {t("admin.mobileSummary", { bookings: b.bookings_total, services: b.services_count })}{" "}
                      {fmt.money(b.gmv)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ------------------------------------------------- llogari pa biznes */}
      {orphans.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">{t("admin.orphans")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("admin.orphansHint", { count: orphans.length })}
            </p>
          </div>
          <div className="divide-y divide-border">
            {orphans.map((o) => (
              <Link
                key={o.user_id}
                href={`/admin/${o.user_id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/40"
              >
                <span className="truncate">{o.email}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {fmt.dayMonthFromInstant(o.created_at)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
