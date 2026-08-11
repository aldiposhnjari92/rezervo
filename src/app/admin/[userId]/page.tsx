import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { getFormat, getT } from "@/lib/i18n";
import { formatAlbanianPhone } from "@/lib/phone";
import type { AdminAccount } from "@/lib/admin-types";
import { DAY_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SubscriptionInvoice } from "./subscription-invoice";
import { SuspendControl } from "./suspend-control";

export const metadata: Metadata = { title: "Llogaria" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminAccountPage({ params }: { params: { userId: string } }) {
  if (!UUID.test(params.userId)) notFound();

  const supabase = createClient();
  const { data } = await supabase.rpc("admin_account", { p_user_id: params.userId });
  const account = data as AdminAccount | null;

  if (!account) notFound();

  const { user, business, stats } = account;
  const t = getT();
  const fmt = getFormat();

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.allBusinesses")}
      </Link>

      {/* ---------------------------------------------------------------- koka */}
      <PageHeader
        title={business?.name ?? t("admin.noBusinessTitle")}
        description={user.email}
        badges={
          <>
            {user.is_admin && (
              <Badge className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
            {business?.suspended_at && (
              <Badge variant="warning" className="gap-1">
                <Ban className="h-3 w-3" />
                {t("admin.suspendedBadge")}
              </Badge>
            )}
          </>
        }
        action={
          business && (
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              rezervo.al/{business.slug}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )
        }
      />

      {/* --------------------------------------------------------- të dhënat */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="border-b border-border px-5 py-3 font-semibold">{t("admin.accountCard")}</h2>
          <dl className="divide-y divide-border">
            <Row label={t("auth.email")} value={user.email} />
            <Row
              label={t("admin.emailConfirmed")}
              value={user.email_confirmed ? t("admin.yes") : t("admin.no")}
              tone={user.email_confirmed ? "default" : "warning"}
            />
            <Row label={t("admin.registered")} value={fmt.dayMonthFromInstant(user.created_at)} />
            <Row
              label={t("admin.lastSignIn")}
              value={
                user.last_sign_in_at
                  ? `${fmt.dayMonthFromInstant(user.last_sign_in_at)} · ${fmt.time(user.last_sign_in_at)}`
                  : t("admin.never")
              }
            />
            <Row label="ID" value={<span className="font-mono text-xs">{user.id}</span>} />
          </dl>
        </Card>

        {business ? (
          <Card>
            <h2 className="border-b border-border px-5 py-3 font-semibold">{t("admin.businessCard")}</h2>
            <dl className="divide-y divide-border">
              <Row label={t("public.name")} value={business.name} />
              <Row label={t("setup.yourLink")} value={`/${business.slug}`} />
              <Row
                label={t("settings.phone")}
                value={business.phone ? formatAlbanianPhone(business.phone) : "—"}
              />
              <Row label={t("admin.registered")} value={fmt.dayMonthFromInstant(business.created_at)} />
              <Row
                label={t("settings.tabHours")}
                value={
                  <span className="text-right">
                    {t("hours.daysPerWeek", { count: DAY_KEYS.filter((d) => business.working_hours?.[d]).length })}
                  </span>
                }
              />
            </dl>
          </Card>
        ) : (
          <EmptyState
            icon={Store}
            title={t("admin.noBusinessTitle")}
            description={t("admin.noBusinessBody", { date: fmt.dayMonthFromInstant(user.created_at) })}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ numrat */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("admin.bookings")} value={stats.bookings} />
          <StatTile label={fmt.status("completed")} value={stats.completed} />
          <StatTile
            label={t("calendar.statNoShows")}
            value={stats.no_shows}
            tone={stats.no_shows > 0 ? "warning" : "default"}
          />
          <StatTile label={t("admin.colValue")} value={fmt.money(stats.gmv)} />
        </div>
      )}

      {/* ---------------------------------------------------------- shërbimet */}
      {account.services.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 font-semibold">
            {t("services.title")} ({account.services.length})
          </h2>
          <ul className="divide-y divide-border">
            {account.services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", !s.is_active && "text-muted-foreground")}>
                    {s.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fmt.duration(s.duration_minutes)} · {fmt.price(s.price)}
                  </p>
                </div>
                {!s.is_active && <Badge variant="secondary">{t("services.inactive")}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* -------------------------------------------------- rezervimet e fundit */}
      {account.recent_bookings.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="font-semibold">{t("admin.recentBookings")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("admin.phonesHidden")}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {account.recent_bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {fmt.dayMonthFromInstant(b.start_time)}
                </span>
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                  {fmt.time(b.start_time)}
                </span>
                <span className="min-w-0 flex-1 truncate">{b.customer_name}</span>
                <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
                  {b.service_name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmt.status(b.status)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------ fatura e abonimit */}
      {business && <SubscriptionInvoice businessId={business.id} />}

      {/* ---------------------------------------------------------- pezullimi */}
      {business && (
        <SuspendControl
          businessId={business.id}
          businessName={business.name}
          suspendedAt={business.suspended_at}
          suspendedReason={business.suspended_reason}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-sm font-medium",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
