"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Phone, Repeat, Search, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { formatDayMonthFromInstant, formatMoney } from "@/lib/availability";
import { formatAlbanianPhone } from "@/lib/phone";
import type { CustomerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "visits" | "spent" | "noshows";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Të fundit" },
  { key: "visits", label: "Më besnikët" },
  { key: "spent", label: "Më fitimprurësit" },
  { key: "noshows", label: "Problematikët" },
];

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

export function CustomersList({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

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
        <PageHeader title="Klientët" description="Lista ndërtohet vetë nga rezervimet." />
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </span>
          <p className="font-semibold">Ende asnjë klient</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Sapo dikush të rezervojë, do ta shohësh këtu bashkë me historikun e vizitave dhe
            sa ka shpenzuar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Klientët"
        description={`${totals.all} klientë · ${formatMoney(totals.spent)} gjithsej`}
      />

      <div className="grid grid-cols-3 gap-3">
        <Summary label="Klientë" value={String(totals.all)} />
        <Summary
          label="Kthehen sërish"
          value={String(totals.repeat)}
          hint={totals.all ? `${Math.round((totals.repeat / totals.all) * 100)}%` : undefined}
        />
        <Summary
          label="Me mosardhje"
          value={String(totals.risky)}
          tone={totals.risky ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko me emër ose numër"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Pastro kërkimin"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar lg:ml-auto">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                sort === s.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Asnjë klient nuk përputhet me &quot;{query}&quot;.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Klienti</th>
                  <th className="px-3 py-3 text-right font-medium">Vizita</th>
                  <th className="px-3 py-3 text-right font-medium">Erdhi</th>
                  <th className="px-3 py-3 text-right font-medium">Nuk erdhi</th>
                  <th className="px-3 py-3 text-right font-medium">Shpenzuar</th>
                  <th className="px-3 py-3 font-medium">Vizita e fundit</th>
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
                              Klient që nga {formatDayMonthFromInstant(c.first_visit)}
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
                        {formatMoney(c.total_spent)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDayMonthFromInstant(c.last_visit)}
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
                          <span className="text-xs text-muted-foreground">Pa numër</span>
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
                          {formatMoney(c.total_spent)}
                        </p>
                      </div>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDayMonthFromInstant(c.last_visit)} · {c.visits}{" "}
                        {c.visits === 1 ? "vizitë" : "vizita"} · {c.completed} erdhi
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.visits > 1 && (
                          <Badge variant="secondary" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            Klient i rregullt
                          </Badge>
                        )}
                        {c.no_shows >= 2 && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {c.no_shows} mosardhje
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {c.customer_phone && (
                    <a
                      href={`tel:${c.customer_phone}`}
                      className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      <span className="tabular-nums">{formatAlbanianPhone(c.customer_phone)}</span>
                    </a>
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

function Summary({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "warning" && "text-amber-700 dark:text-amber-400",
          )}
        >
          {value}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </p>
    </div>
  );
}
