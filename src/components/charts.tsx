"use client";

import { useState } from "react";

import { formatDayMonth } from "@/lib/availability";
import { STATUS_COLORS, STATUS_ORDER, type DailyBookings } from "@/lib/admin-types";
import { STATUS_LABELS_SQ, type BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rrumbullakos lart te një numër i pastër, që etiketat e boshtit të lexohen. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

// ---------------------------------------------------------------------------
//  Rezervime për ditë — një seri, ndaj pa legjendë (titulli e thotë çfarë është)
// ---------------------------------------------------------------------------

export function BookingsChart({ data }: { data: DailyBookings[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = niceMax(Math.max(1, ...data.map((d) => d.bookings)));
  const total = data.reduce((sum, d) => sum + d.bookings, 0);
  const ticks = [max, max / 2, 0];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Rezervime për ditë</h2>
        <span className="text-sm text-muted-foreground">{data.length} ditët e fundit</span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {total.toLocaleString("de-DE")} rezervime gjithsej në këtë periudhë
      </p>

      <div className="flex gap-2">
        {/* boshti i vlerave */}
        <div className="flex h-40 w-8 shrink-0 flex-col justify-between text-right">
          {ticks.map((t) => (
            <span key={t} className="text-[11px] tabular-nums leading-none text-muted-foreground">
              {t.toLocaleString("de-DE")}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* vijat ndihmëse — hairline, jo të ndërprera, të zbehta */}
          <div className="pointer-events-none absolute inset-0">
            {[0, 50, 100].map((pct) => (
              <div
                key={pct}
                className="absolute inset-x-0 border-t border-border"
                style={{ top: `${pct}%` }}
              />
            ))}
          </div>

          {/* kolonat */}
          <div className="relative flex h-40 items-end gap-[2px]">
            {data.map((day, i) => {
              const pct = (day.bookings / max) * 100;
              const active = hover === i;

              return (
                <button
                  key={day.day}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${formatDayMonth(day.day)}: ${day.bookings} rezervime`}
                  className="group relative flex h-full flex-1 items-end justify-center"
                >
                  {/* zona e kapjes është e gjithë kolona; vizualja është vetëm shiriti */}
                  <span
                    className={cn(
                      "w-full max-w-[24px] rounded-t-[4px] transition-opacity",
                      day.bookings === 0 && "min-h-[2px] bg-muted",
                    )}
                    style={
                      day.bookings > 0
                        ? {
                            height: `${Math.max(pct, 1.5)}%`,
                            backgroundColor: STATUS_COLORS.confirmed,
                            opacity: hover === null || active ? 1 : 0.45,
                          }
                        : undefined
                    }
                  />
                </button>
              );
            })}
          </div>

          {/* tooltip */}
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-md"
              style={{
                left: `${((hover + 0.5) / data.length) * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="whitespace-nowrap text-xs font-medium">
                {formatDayMonth(data[hover].day)}
              </p>
              <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {data[hover].bookings} rezervime · {data[hover].no_shows} pa ardhur
              </p>
            </div>
          )}

          {/* etiketat e datave: vetëm skajet dhe mesi */}
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{formatDayMonth(data[0]?.day ?? "")}</span>
            <span className="hidden sm:inline">
              {formatDayMonth(data[Math.floor(data.length / 2)]?.day ?? "")}
            </span>
            <span>{formatDayMonth(data[data.length - 1]?.day ?? "")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Ndarja sipas statusit — pjesë-ndaj-së-tërës, ndaj shirit i stivosur
// ---------------------------------------------------------------------------

export function StatusBreakdown({
  counts,
}: {
  counts: Record<BookingStatus, number>;
}) {
  const [hover, setHover] = useState<BookingStatus | null>(null);

  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const shown = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0);

  const attendance = counts.completed + counts.no_show;
  const noShowRate = attendance > 0 ? (counts.no_show / attendance) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Statusi i rezervimeve</h2>
        <span className="text-sm text-muted-foreground">{total.toLocaleString("de-DE")} gjithsej</span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {attendance > 0
          ? `${noShowRate.toFixed(1)}% e klientëve nuk erdhën`
          : "Ende pa të dhëna për pjesëmarrjen"}
      </p>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Ende asnjë rezervim
        </div>
      ) : (
        <>
          {/* shiriti: 2px hapësirë sipërfaqeje mes segmenteve, jo vija ndarëse */}
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
            {shown.map((status) => (
              <div
                key={status}
                onMouseEnter={() => setHover(status)}
                onMouseLeave={() => setHover(null)}
                title={`${STATUS_LABELS_SQ[status]}: ${counts[status]}`}
                className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(counts[status] / total) * 100}%`,
                  backgroundColor: STATUS_COLORS[status],
                  opacity: hover === null || hover === status ? 1 : 0.45,
                }}
              />
            ))}
          </div>

          {/* legjenda mban çdo vlerë — identiteti nuk varet kurrë vetëm nga ngjyra */}
          <ul className="mt-5 space-y-2.5">
            {STATUS_ORDER.map((status) => {
              const value = counts[status] ?? 0;
              const pct = total > 0 ? (value / total) * 100 : 0;

              return (
                <li
                  key={status}
                  onMouseEnter={() => setHover(status)}
                  onMouseLeave={() => setHover(null)}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <span className="flex-1 truncate">{STATUS_LABELS_SQ[status]}</span>
                  <span className="tabular-nums font-medium">{value.toLocaleString("de-DE")}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Të ardhurat për ditë — një seri, ndaj pa legjendë
// ---------------------------------------------------------------------------

export function EarningsChart({
  data,
  days,
}: {
  data: { day: string; earnings: number; bookings: number }[];
  days: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = niceMax(Math.max(1, ...data.map((d) => d.earnings)));
  const total = data.reduce((sum, d) => sum + d.earnings, 0);
  const best = data.reduce((a, b) => (b.earnings > a.earnings ? b : a), data[0]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Të ardhurat</h2>
        <span className="text-sm text-muted-foreground">{days} ditët e fundit</span>
      </div>
      <p className="mb-5 text-2xl font-semibold tracking-tight tabular-nums">
        {total.toLocaleString("de-DE")}{" "}
        <span className="text-base font-normal text-muted-foreground">Lek</span>
      </p>

      <div className="flex gap-2">
        <div className="flex h-36 w-12 shrink-0 flex-col justify-between text-right">
          {[max, max / 2, 0].map((t) => (
            <span key={t} className="text-[11px] tabular-nums leading-none text-muted-foreground">
              {Math.round(t).toLocaleString("de-DE")}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0">
            {[0, 50, 100].map((pct) => (
              <div
                key={pct}
                className="absolute inset-x-0 border-t border-border"
                style={{ top: `${pct}%` }}
              />
            ))}
          </div>

          <div className="relative flex h-36 items-end gap-[2px]">
            {data.map((day, i) => {
              const pct = (day.earnings / max) * 100;
              const active = hover === i;
              return (
                <button
                  key={day.day}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${formatDayMonth(day.day)}: ${day.earnings} Lek`}
                  className="relative flex h-full flex-1 items-end justify-center"
                >
                  <span
                    className={cn(
                      "w-full max-w-[24px] rounded-t-[4px] transition-opacity",
                      day.earnings === 0 && "min-h-[2px] bg-muted",
                    )}
                    style={
                      day.earnings > 0
                        ? {
                            height: `${Math.max(pct, 1.5)}%`,
                            backgroundColor: STATUS_COLORS.completed,
                            opacity: hover === null || active ? 1 : 0.45,
                          }
                        : undefined
                    }
                  />
                </button>
              );
            })}
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 z-10 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-md"
              style={{
                left: `${((hover + 0.5) / data.length) * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="whitespace-nowrap text-xs font-medium">
                {formatDayMonth(data[hover].day)}
              </p>
              <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {data[hover].earnings.toLocaleString("de-DE")} Lek ·{" "}
                {data[hover].bookings} rezervime
              </p>
            </div>
          )}

          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{formatDayMonth(data[0]?.day ?? "")}</span>
            <span>{formatDayMonth(data[data.length - 1]?.day ?? "")}</span>
          </div>
        </div>
      </div>

      {best && best.earnings > 0 && (
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
          Dita më e mirë: <span className="font-medium text-foreground">
            {formatDayMonth(best.day)}
          </span>{" "}
          me {best.earnings.toLocaleString("de-DE")} Lek
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Shpërndarja sipas ditës së javës — magnitudë, ndaj një ngjyrë e vetme
// ---------------------------------------------------------------------------

export function DistributionBars({
  title,
  subtitle,
  data,
  emptyLabel = "Ende pa të dhëna",
}: {
  title: string;
  subtitle?: string;
  data: { label: string; value: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}

      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.map((row) => (
            <li key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 text-muted-foreground">{row.label}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(row.value / max) * 100}%`,
                    backgroundColor: STATUS_COLORS.confirmed,
                  }}
                />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums font-medium">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
