"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Phone, Repeat, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useFormat, useT } from "@/lib/i18n/provider";
import { SearchInput } from "@/components/search-input";
import { Segmented, SegmentedButton } from "@/components/segmented";
import { StatTile } from "@/components/stat-tile";
import { formatAlbanianPhone } from "@/lib/phone";
import type { CustomerRow } from "@/lib/types";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { openingText } from "@/lib/whatsapp-messages";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "visits" | "spent" | "noshows";

const SORTS = [
  { key: "recent", label: "customers.sortRecent" },
  { key: "visits", label: "customers.sortVisits" },
  { key: "spent", label: "customers.sortSpent" },
  { key: "noshows", label: "customers.sortNoShows" },
] as const;

/** "Ana Hoxha" -> "AH". Lista skanohet me sy, jo duke lexuar çdo rresht. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/** Besnikët dhe problematikët duhen dalluar pa u lexuar rreshti. */
function toneFor(c: CustomerRow) {
  if (c.no_shows >= 2) return "risky" as const;
  if (c.visits >= 3) return "loyal" as const;
  return "plain" as const;
}

export function CustomersList({
  customers,
  businessName,
}: {
  customers: CustomerRow[];
  businessName: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const t = useT();
  const fmt = useFormat();

  const totals = useMemo(
    () => ({
      all: customers.length,
      repeat: customers.filter((c) => c.visits > 1).length,
      risky: customers.filter((c) => c.no_shows >= 2).length,
      spent: customers.reduce((sum, c) => sum + c.total_spent, 0),
    }),
    [customers],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? customers.filter(
          (c) =>
            c.customer_name.toLowerCase().includes(q) ||
            (c.customer_phone ?? "").includes(q.replace(/\s/g, "")),
        )
      : customers;

    const sorted = [...filtered];
    if (sort === "visits") sorted.sort((a, b) => b.visits - a.visits);
    else if (sort === "spent") sorted.sort((a, b) => b.total_spent - a.total_spent);
    else if (sort === "noshows") sorted.sort((a, b) => b.no_shows - a.no_shows);
    else sorted.sort((a, b) => b.last_visit.localeCompare(a.last_visit));

    return sorted;
  }, [customers, query, sort]);

  if (customers.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("customers.title")} description={t("customers.autoBuilt")} />
        <EmptyState
          icon={Users}
          title={t("customers.emptyTitle")}
          description={t("customers.emptyBody")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("customers.title")}
        description={t("customers.subtitle", { count: totals.all, total: fmt.money(totals.spent) })}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t("customers.tileAll")} value={totals.all} />
        <StatTile
          label={t("customers.tileRepeat")}
          value={totals.repeat}
          hint={totals.all ? t("customers.tileRepeatHint", { percent: Math.round((totals.repeat / totals.all) * 100) }) : undefined}
        />
        <StatTile
          label={t("customers.tileRisky")}
          value={totals.risky}
          tone={totals.risky ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("customers.searchPlaceholder")}
          className="lg:max-w-xs lg:flex-1"
        />

        <div className="lg:ml-auto">
          <Segmented scroll>
            {SORTS.map((s) => (
              <SegmentedButton
                key={s.key}
                active={sort === s.key}
                onClick={() => setSort(s.key)}
              >
                {t(s.label)}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {t("customers.noMatch", { query })}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">{t("customers.colName")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("customers.colVisits")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("customers.colCame")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("customers.colMissed")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("customers.colSpent")}</th>
                  <th className="px-3 py-3 font-medium">{t("customers.colLast")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const tone = toneFor(c);
                  return (
                    <tr
                      key={c.customer_key}
                      className={cn(
                        "border-b border-border transition-colors last:border-0 hover:bg-muted/40",
                        tone === "risky" && "bg-amber-500/[0.06]",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.customer_name} tone={tone} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.customer_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {t("customers.since", { date: fmt.dayMonthFromInstant(c.first_visit) })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{c.visits}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {c.completed}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {c.no_shows > 0 ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {c.no_shows}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {fmt.money(c.total_spent)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {fmt.dayMonthFromInstant(c.last_visit)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.customer_phone ? (
                          <a
                            href={`tel:${c.customer_phone}`}
                            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span className="tabular-nums">
                              {formatAlbanianPhone(c.customer_phone)}
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("common.noPhone")}</span>
                        )}
                        {c.customer_phone && (
                          <WhatsAppButton
                            phone={c.customer_phone}
                            size="icon"
                            variant="ghost"
                            label={t("whatsapp.messageCustomer")}
                            message={openingText(c.customer_name, businessName)}
                            className="ml-1 align-middle text-muted-foreground hover:text-foreground"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {visible.map((c) => {
              const tone = toneFor(c);
              return (
                <li
                  key={c.customer_key}
                  className={cn(
                    "rounded-2xl border border-border bg-card p-4",
                    tone === "risky" && "border-amber-500/30 bg-amber-500/[0.06]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={c.customer_name} tone={tone} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate font-medium">{c.customer_name}</p>
                        <p className="shrink-0 font-medium tabular-nums">
                          {fmt.money(c.total_spent)}
                        </p>
                      </div>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("customers.visitSummary", {
                          date: fmt.dayMonthFromInstant(c.last_visit),
                          visits:
                            c.visits === 1
                              ? t("customers.visitOne")
                              : t("customers.visitMany", { count: c.visits }),
                          completed: c.completed,
                        })}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.visits > 1 && (
                          <Badge variant="secondary" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            {t("customers.regular")}
                          </Badge>
                        )}
                        {c.no_shows >= 2 && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t("customers.noShowBadge", { count: c.no_shows })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {c.customer_phone && (
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`tel:${c.customer_phone}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-primary"
                      >
                        <Phone className="h-4 w-4" />
                        <span className="tabular-nums">{formatAlbanianPhone(c.customer_phone)}</span>
                      </a>
                      <WhatsAppButton
                        phone={c.customer_phone}
                        label={t("whatsapp.message")}
                        message={openingText(c.customer_name, businessName)}
                        className="shrink-0"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: "risky" | "loyal" | "plain" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tone === "risky"
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : tone === "loyal"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
      )}
    >
      {initials(name)}
    </span>
  );
}
