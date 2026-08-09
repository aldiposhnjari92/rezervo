import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/charts";
import { createClient } from "@/lib/supabase/server";
import {
  formatDayMonthFromInstant,
  formatDuration,
  formatPrice,
  formatTime,
} from "@/lib/availability";
import { formatAlbanianPhone } from "@/lib/phone";
import type { AdminAccount } from "@/lib/admin-types";
import { DAY_KEYS, STATUS_LABELS_SQ } from "@/lib/types";
import { cn } from "@/lib/utils";
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

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Të gjitha bizneset
      </Link>

      {/* ---------------------------------------------------------------- koka */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {business?.name ?? "Llogari pa dyqan"}
            </h1>
            {user.is_admin && (
              <Badge className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
            {business?.suspended_at && (
              <Badge variant="warning" className="gap-1">
                <Ban className="h-3 w-3" />
                Pezulluar
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>

        {business && (
          <a
            href={`/${business.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-primary hover:underline"
          >
            rezervo.al/{business.slug}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* --------------------------------------------------------- të dhënat */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-background">
          <h2 className="border-b border-border px-5 py-3 font-semibold">Llogaria</h2>
          <dl className="divide-y divide-border">
            <Row label="Email" value={user.email} />
            <Row
              label="Email i konfirmuar"
              value={user.email_confirmed ? "Po" : "Jo"}
              tone={user.email_confirmed ? "default" : "warning"}
            />
            <Row label="Regjistruar" value={formatDayMonthFromInstant(user.created_at)} />
            <Row
              label="Hyrja e fundit"
              value={
                user.last_sign_in_at
                  ? `${formatDayMonthFromInstant(user.last_sign_in_at)} · ${formatTime(user.last_sign_in_at)}`
                  : "Kurrë"
              }
            />
            <Row label="ID" value={<span className="font-mono text-xs">{user.id}</span>} />
          </dl>
        </section>

        {business ? (
          <section className="rounded-xl border border-border bg-background">
            <h2 className="border-b border-border px-5 py-3 font-semibold">Biznesi</h2>
            <dl className="divide-y divide-border">
              <Row label="Emri" value={business.name} />
              <Row label="Linku" value={`/${business.slug}`} />
              <Row
                label="Telefoni"
                value={business.phone ? formatAlbanianPhone(business.phone) : "—"}
              />
              <Row label="Krijuar" value={formatDayMonthFromInstant(business.created_at)} />
              <Row
                label="Orari"
                value={
                  <span className="text-right">
                    {DAY_KEYS.filter((d) => business.working_hours?.[d]).length} ditë në javë
                  </span>
                }
              />
            </dl>
          </section>
        ) : (
          <section className="flex items-center justify-center rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <div>
              <p className="font-medium">Kjo llogari nuk ka krijuar dyqan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                U regjistrua më {formatDayMonthFromInstant(user.created_at)} por nuk e mbaroi
                konfigurimin.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* ------------------------------------------------------------ numrat */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Rezervime" value={stats.bookings} />
          <StatTile label="Përfunduar" value={stats.completed} />
          <StatTile
            label="Nuk erdhën"
            value={stats.no_shows}
            tone={stats.no_shows > 0 ? "warning" : "default"}
          />
          <StatTile label="Vlera" value={formatPrice(stats.gmv)} />
        </div>
      )}

      {/* ---------------------------------------------------------- shërbimet */}
      {account.services.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <h2 className="border-b border-border px-5 py-3 font-semibold">
            Shërbimet ({account.services.length})
          </h2>
          <ul className="divide-y divide-border">
            {account.services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", !s.is_active && "text-muted-foreground")}>
                    {s.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(s.duration_minutes)} · {formatPrice(s.price)}
                  </p>
                </div>
                {!s.is_active && <Badge variant="secondary">Joaktiv</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -------------------------------------------------- rezervimet e fundit */}
      {account.recent_bookings.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="border-b border-border px-5 py-3">
            <h2 className="font-semibold">Rezervimet e fundit</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Numrat e telefonit të klientëve nuk shfaqen këtu.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {account.recent_bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {formatDayMonthFromInstant(b.start_time)}
                </span>
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                  {formatTime(b.start_time)}
                </span>
                <span className="min-w-0 flex-1 truncate">{b.customer_name}</span>
                <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">
                  {b.service_name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {STATUS_LABELS_SQ[b.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
