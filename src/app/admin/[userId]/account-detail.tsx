import Link from "next/link";
import { ArrowLeft, Ban, ExternalLink, ShieldCheck, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { getFormat, getT } from "@/lib/i18n";
import { formatAlbanianPhone } from "@/lib/phone";
import type { AdminAccount } from "@/lib/admin-types";
import { DAY_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SubscriptionInvoice } from "./subscription-invoice";
import { SuspendControl } from "./suspend-control";

/**
 * Vetëm pamja e një llogarie — të dhënat i sjell faqja.
 *
 * E ndarë nga marrja e të dhënave që e njëjta pamje të mund të vizatohet edhe me
 * të dhëna të rreme, pa prekur bazën: kështu matet dhe shihet në telefon.
 */
export function AccountDetail({ account }: { account: AdminAccount }) {
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
          <h2 className="border-b border-border px-4 py-3 font-semibold sm:px-5">{t("admin.accountCard")}</h2>
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
            <h2 className="border-b border-border px-4 py-3 font-semibold sm:px-5">{t("admin.businessCard")}</h2>
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
                value={t("hours.daysPerWeek", {
                  count: DAY_KEYS.filter((d) => business.working_hours?.[d]).length,
                })}
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
          <h2 className="border-b border-border px-4 py-3 font-semibold sm:px-5">
            {t("services.title")} ({account.services.length})
          </h2>
          <ul className="divide-y divide-border">
            {account.services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
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
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-semibold">{t("admin.recentBookings")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("admin.phonesHidden")}
            </p>
          </div>
          {/*
            Kush erdhi është e para, jo kur.
            Me kolona të gjera për datën dhe orën, emrit i mbetej një e treta e
            rreshtit dhe pritej te "Ardit Ho…" — ndërsa data kishte vend me
            tepricë. Njësoj si lista e shërbimeve pak më lart: emri sipër, hollësitë
            poshtë tij.
          */}
          <ul className="divide-y divide-border">
            {account.recent_bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.customer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {fmt.dayMonthFromInstant(b.start_time)} · {fmt.time(b.start_time)}
                    </span>
                    {" · "}
                    {b.service_name}
                  </p>
                </div>
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
  /*
    Në telefon vlera zbret nën etiketën e vet.
    Të dyja në një rresht do të thoshte se një email ose një ID me 36 shkronja
    ndante gjerësinë me etiketën dhe mbaronte me "…" pikërisht atje ku fillon
    ajo që admini ka ardhur të lexojë.
  */
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-sm font-medium sm:text-right",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
