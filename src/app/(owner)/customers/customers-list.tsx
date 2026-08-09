"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Phone, Repeat, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { formatDayMonthFromInstant, formatPrice } from "@/lib/availability";
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
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-background px-6 py-14 text-center">
          <Users className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Ende asnjë klient</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Sapo dikush të rezervojë, do ta shohësh këtu bashkë me historikun e vizitave.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Klientët"
        description={`${totals.all} klientë · ${totals.repeat} kthehen sërish`}
      />

      <div className="grid grid-cols-3 gap-3">
        <Mini label="Klientë" value={totals.all} />
        <Mini label="Të përsëritur" value={totals.repeat} />
        <Mini
          label="Me mosardhje"
          value={totals.risky}
          tone={totals.risky > 0 ? "warning" : "default"}
        />
      </div>

      {/* filtrat: një rresht mbi listë */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko me emër ose numër"
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
        <p className="rounded-xl border border-dashed border-border bg-background py-10 text-center text-sm text-muted-foreground">
          Asnjë klient nuk përputhet me &quot;{query}&quot;.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => {
            const risky = c.no_shows >= 2;

            return (
              <li
                key={c.customer_key}
                className={cn(
                  "rounded-xl border border-border bg-background p-4",
                  risky && "border-amber-500/30 bg-amber-500/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{c.customer_name}</p>
                      {c.visits > 1 && (
                        <Badge variant="secondary" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {c.visits}× vizita
                        </Badge>
                      )}
                      {risky && (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {c.no_shows} mosardhje
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Vizita e fundit {formatDayMonthFromInstant(c.last_visit)} · klient që nga{" "}
                      {formatDayMonthFromInstant(c.first_visit)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">{formatPrice(c.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">gjithsej</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">{c.completed}</span> erdhi
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{c.no_shows}</span> jo
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{c.cancelled}</span> anuluar
                    </span>
                  </div>

                  {c.customer_phone ? (
                    <a
                      href={`tel:${c.customer_phone}`}
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span className="tabular-nums">
                        {formatAlbanianPhone(c.customer_phone)}
                      </span>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pa numër</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}
