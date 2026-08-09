import Link from "next/link";
import { ChevronRight, Ban } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { BookingsChart, StatTile, StatusBreakdown } from "@/components/charts";
import { createClient } from "@/lib/supabase/server";
import { formatDayMonthFromInstant, formatMoney } from "@/lib/availability";
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
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <p className="font-medium">Analitika nuk u ngarkua</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {overviewRes.error?.message ?? "Provo të rifreskosh faqen."}
        </p>
      </div>
    );
  }

  const activationRate =
    overview.users_total > 0
      ? Math.round((overview.businesses_total / overview.users_total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pamja e platformës</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Të gjitha bizneset, llogaritë dhe rezervimet në Rezervo.al.
        </p>
      </div>

      {/* ------------------------------------------------------- numrat kryesorë */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Biznese"
          value={overview.businesses_total}
          hint={`+${overview.businesses_new_30d} këtë muaj`}
        />
        <StatTile
          label="Llogari"
          value={overview.users_total}
          hint={`${activationRate}% krijuan dyqan`}
        />
        <StatTile
          label="Rezervime"
          value={overview.bookings_total}
          hint={`${overview.bookings_30d.toLocaleString("de-DE")} 30 ditët e fundit`}
        />
        <StatTile
          label="Vlera e shërbimeve"
          value={formatMoney(overview.gmv_total)}
          hint={`${formatMoney(overview.gmv_30d)} 30 ditët e fundit`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Aktive (30 ditë)"
          value={overview.businesses_active_30d}
          hint="me të paktën 1 rezervim"
        />
        <StatTile label="Rezervime në pritje" value={overview.bookings_upcoming} />
        <StatTile label="Shërbime aktive" value={overview.services_total} />
        <StatTile
          label="Të pezulluara"
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
      <section className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold">Bizneset</h2>
          <span className="text-sm text-muted-foreground">{businesses.length}</span>
        </div>

        {businesses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Ende asnjë biznes i regjistruar.
          </p>
        ) : (
          <>
            {/* tabelë në desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Biznesi</th>
                    <th className="px-3 py-2.5 font-medium">Pronari</th>
                    <th className="px-3 py-2.5 text-right font-medium">Shërbime</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rezervime</th>
                    <th className="px-3 py-2.5 text-right font-medium">30 ditë</th>
                    <th className="px-3 py-2.5 text-right font-medium">Pa ardhur</th>
                    <th className="px-3 py-2.5 text-right font-medium">Vlera</th>
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
                              Pezulluar
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
                      <td className="px-3 py-3 text-right tabular-nums">{formatMoney(b.gmv)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/${b.owner_id}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          Hap
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
                          Pezulluar
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{b.owner_email}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {b.bookings_total} rezervime · {b.services_count} shërbime ·{" "}
                      {formatMoney(b.gmv)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------- llogari pa biznes */}
      {orphans.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Llogari pa dyqan</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              U regjistruan por nuk e mbaruan konfigurimin — {orphans.length} gjithsej.
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
                  {formatDayMonthFromInstant(o.created_at)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
