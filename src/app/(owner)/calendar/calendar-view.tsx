"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented, SegmentedButton } from "@/components/segmented";
import { useFormat, useT } from "@/lib/i18n/provider";
import { useReadOnly } from "../read-only";
import {
  CALENDAR_VIEWS,
  groupByDate,
  headingForView,
  isSameMonth,
  layoutDay,
  minutesFromMidnight,
  monthGrid,
  startOfMonth,
  stepDate,
  visibleHourRange,
  weekDates,
  type CalendarView as View,
} from "@/lib/calendar";
import {
  DAY_KEYS,
  type BookingStatus,
  type BookingWithService,
  type Service,
  type WorkingHours,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingDialog } from "./booking-dialog";
import { ManualBookingDialog } from "./manual-booking-dialog";

/** Lartësia e një ore në piksel, sipas pamjes. */
const HOUR_PX: Record<"day" | "week", number> = { day: 64, week: 48 };

/** Etiketat e pamjeve janë çelësa fjalori, jo tekst i fiksuar. */
const VIEW_KEYS = {
  month: "calendar.month",
  week: "calendar.week",
  day: "calendar.day",
} as const;

const STATUS_BLOCK: Record<BookingStatus, string> = {
  confirmed: "border-l-primary bg-primary/10 text-foreground",
  completed: "border-l-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  no_show: "border-l-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  cancelled: "border-l-slate-300 bg-muted text-muted-foreground line-through",
};

const STATUS_DOT: Record<BookingStatus, string> = {
  confirmed: "bg-primary",
  completed: "bg-emerald-500",
  no_show: "bg-amber-500",
  cancelled: "bg-slate-400",
};

export function CalendarView({
  view,
  date,
  today,
  bookings,
  workingHours,
  services,
  businessName,
  businessPhone,
}: {
  view: View;
  date: string;
  today: string;
  bookings: BookingWithService[];
  workingHours: WorkingHours;
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price">[];
  businessName: string;
  businessPhone: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<BookingWithService | null>(null);
  const [adding, setAdding] = useState(false);
  const readOnly = useReadOnly();
  const t = useT();
  const fmt = useFormat();

  function go(nextView: View, nextDate: string) {
    startTransition(() => {
      router.push(`/calendar?view=${nextView}&date=${nextDate}`);
    });
  }

  const byDate = useMemo(() => groupByDate(bookings), [bookings]);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const revenue = active
    .filter((b) => b.status !== "no_show")
    .reduce((sum, b) => sum + (b.services?.price ?? 0), 0);
  const noShows = bookings.filter((b) => b.status === "no_show").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* ------------------------------------------------------------ toolbar */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-background">
            <button
              type="button"
              onClick={() => go(view, stepDate(view, date, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("calendar.prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(view, today)}
              className="h-9 border-x border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("calendar.today")}
            </button>
            <button
              type="button"
              onClick={() => go(view, stepDate(view, date, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("calendar.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            {headingForView(view, date, fmt.months)}
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        <div className="flex items-center gap-2">
        {/* ndërruesi i pamjeve */}
        <Segmented className="flex-1 sm:flex-none">
          {CALENDAR_VIEWS.map((item) => (
            <SegmentedButton key={item} active={view === item} onClick={() => go(item, date)}>
              {t(VIEW_KEYS[item])}
            </SegmentedButton>
          ))}
        </Segmented>

        {!readOnly && (
          <Button size="sm" className="shrink-0" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("calendar.newBooking")}</span>
          </Button>
        )}
        </div>
      </div>

      {/* --------------------------------------------------------- statistika */}
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Stat label={t("calendar.statBookings")} value={active.length} />
        <Stat label={t("calendar.statRevenue")} value={fmt.money(revenue)} />
        <Stat label={t("calendar.statNoShows")} value={noShows} tone={noShows ? "warning" : "default"} />
      </div>

      {/* --------------------------------------------------------------- pamja */}
      <div className={cn("flex min-h-0 flex-1 flex-col transition-opacity", pending && "opacity-60")}>
        {view === "month" ? (
          <MonthView
            date={date}
            today={today}
            byDate={byDate}
            onPickDay={(day) => go("day", day)}
            onPickBooking={setSelected}
          />
        ) : (
          <TimeGrid
            variant={view}
            dates={view === "week" ? weekDates(date) : [date]}
            today={today}
            byDate={byDate}
            workingHours={workingHours}
            bookings={bookings}
            onPickDay={(day) => go("day", day)}
            onPickBooking={setSelected}
          />
        )}
      </div>

      <BookingDialog
        booking={selected}
        businessName={businessName}
        businessPhone={businessPhone}
        onClose={() => setSelected(null)}
      />

      <ManualBookingDialog
        open={adding}
        onOpenChange={setAdding}
        services={services}
        defaultDate={view === "month" ? today : date}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Statistika
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-semibold tabular-nums",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Pamja MUAJ
// ---------------------------------------------------------------------------

function MonthView({
  date,
  today,
  byDate,
  onPickDay,
  onPickBooking,
}: {
  date: string;
  today: string;
  byDate: Map<string, BookingWithService[]>;
  onPickDay: (date: string) => void;
  onPickBooking: (booking: BookingWithService) => void;
}) {
  const grid = monthGrid(date);
  const month = startOfMonth(date);
  const t = useT();
  const fmt = useFormat();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* kokat e ditëve */}
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted/40">
        {DAY_KEYS.map((key) => (
          <div
            key={key}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {fmt.dayShort(key)}
          </div>
        ))}
      </div>

      {/* Rreshtat ndajnë njësoj lartësinë që mbetet; nën `min-h` ndalen së
          ngjeshuri dhe muaji rrëshqet brenda kartelës. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="grid flex-1 auto-rows-[minmax(84px,1fr)] grid-cols-7 sm:auto-rows-[minmax(96px,1fr)]">
        {grid.map((day, index) => {
          const dayBookings = (byDate.get(day) ?? []).filter((b) => b.status !== "cancelled");
          const outside = !isSameMonth(day, month);
          const isToday = day === today;
          const visible = dayBookings.slice(0, 2);
          const overflow = dayBookings.length - visible.length;

          return (
            <div
              key={day}
              className={cn(
                "border-b border-r border-border p-1.5",
                index % 7 === 6 && "border-r-0",
                index >= grid.length - 7 && "border-b-0",
                outside && "bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(day)}
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : outside
                      ? "text-muted-foreground/60 hover:bg-muted"
                      : "hover:bg-muted",
                )}
              >
                {Number(day.slice(8))}
              </button>

              <div className="space-y-1">
                {visible.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onPickBooking(booking)}
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                      STATUS_BLOCK[booking.status],
                      "border-l-2",
                    )}
                  >
                    <span className="shrink-0 font-medium tabular-nums">
                      {fmt.time(booking.start_time)}
                    </span>
                    <span className="truncate">{booking.customer_name}</span>
                  </button>
                ))}

                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onPickDay(day)}
                    className="w-full px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t("calendar.more", { count: overflow })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Pamjet JAVË dhe DITË (e njëjta rrjetë kohore)
// ---------------------------------------------------------------------------

function TimeGrid({
  variant,
  dates,
  today,
  byDate,
  workingHours,
  bookings,
  onPickDay,
  onPickBooking,
}: {
  variant: "week" | "day";
  dates: string[];
  today: string;
  byDate: Map<string, BookingWithService[]>;
  workingHours: WorkingHours;
  bookings: BookingWithService[];
  onPickDay: (date: string) => void;
  onPickBooking: (booking: BookingWithService) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [nowMin, setNowMin] = useState(0);
  const t = useT();
  const fmt = useFormat();

  // Vija e orës aktuale varet nga koha reale — vetëm pas montimit,
  // që serveri dhe klienti të nxjerrin të njëjtin HTML fillestar.
  useEffect(() => {
    setMounted(true);
    const tick = () => setNowMin(minutesFromMidnight(new Date().toISOString()));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const { startMin, endMin } = useMemo(
    () => visibleHourRange(workingHours, bookings, dates),
    [workingHours, bookings, dates],
  );

  const totalMin = endMin - startMin;
  const hours = Array.from({ length: Math.floor(totalMin / 60) + 1 }, (_, i) => startMin + i * 60);

  // Rrjeta pozicionohet me PËRQINDJE, jo me pixel-a fiksë: kështu shtrihet e
  // mbush lartësinë që i mbetet faqes. `minHeight` e ndal së ngjeshuri kur
  // ekrani është i shkurtër — atëherë brendia rrëshqet brenda kartelës.
  const minHeight = (totalMin / 60) * HOUR_PX[variant];
  const pct = (minute: number) => ((minute - startMin) / totalMin) * 100;

  const isEmpty = bookings.filter((b) => b.status !== "cancelled").length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {isEmpty && variant === "day" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <CalendarX2 className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{t("calendar.emptyDayTitle")}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {t("calendar.emptyDayBody")}
          </p>
        </div>
      ) : (
        /* Një enë e vetme rrëshqitëse. Kokat e ditëve rrinë BRENDA saj dhe mbi
           të njëjtën gjerësi minimale si rrjeta: ndryshe, në telefon rrjeta
           lëvizte anash ndërsa datat qëndronin — dhe ora binte nën ditën e
           gabuar. `sticky` i mban ato në pamje kur rrëshqet lart e poshtë. */
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className={cn("flex flex-1 flex-col", variant === "week" && "min-w-[640px]")}>
            {variant === "week" && (
              <div className="sticky top-0 z-30 shrink-0 bg-card">
                <div className="flex border-b border-border bg-muted/40">
                  <div className="w-12 shrink-0 sm:w-14" />
                  <div className="grid flex-1 grid-cols-7">
                    {dates.map((day) => {
                      const isToday = day === today;
                      const count = (byDate.get(day) ?? []).filter(
                        (b) => b.status !== "cancelled",
                      ).length;

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => onPickDay(day)}
                          className="flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-muted/60"
                        >
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {fmt.dayShort(
                              DAY_KEYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7],
                            )}
                          </span>
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                              isToday && "bg-primary text-primary-foreground",
                            )}
                          >
                            {Number(day.slice(8))}
                          </span>
                          {count > 0 && (
                            <span className="text-[10px] text-muted-foreground">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col py-3">
              <div className="flex flex-1" style={{ minHeight }}>
                {/* boshti i orëve */}
                <div className="relative w-12 shrink-0 sm:w-14">
                  {hours.map((minute) => (
                    <span
                      key={minute}
                      className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                      style={{ top: `${pct(minute)}%` }}
                    >
                      {String(Math.floor(minute / 60)).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>

                {/* kolonat e ditëve */}
                <div className={cn("relative flex-1", variant === "week" ? "grid grid-cols-7" : "flex")}>
                  {/* vijat e orëve */}
                  <div className="pointer-events-none absolute inset-0">
                    {hours.map((minute) => (
                      <div
                        key={minute}
                        className="absolute inset-x-0 border-t border-border"
                        style={{ top: `${pct(minute)}%` }}
                      />
                    ))}
                  </div>

                  {dates.map((day) => {
                    const dayBookings = byDate.get(day) ?? [];
                    const positioned = layoutDay(dayBookings);
                    const isToday = day === today;

                    return (
                      <div
                        key={day}
                        className={cn(
                          "relative flex-1 border-l border-border first:border-l-0",
                          isToday && variant === "week" && "bg-primary/[0.03]",
                        )}
                      >
                        {/* vija e orës aktuale */}
                        {mounted && isToday && nowMin >= startMin && nowMin <= endMin && (
                          <div
                            className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                            style={{ top: `${pct(nowMin)}%` }}
                          >
                            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                          </div>
                        )}

                        {positioned.map(({ booking, startMin: s, endMin: e, lane, lanes }) => {
                          // Emri i shërbimit hiqet te rezervimet e shkurtra. Matet me
                          // kohëzgjatjen, jo me pixel-a: blloku shtrihet bashkë me
                          // rrjetën, ndaj lartësia e tij nuk dihet paraprakisht.
                          const compact = e - s < 40;

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              onClick={() => onPickBooking(booking)}
                              className={cn(
                                "absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left transition-shadow hover:shadow-md",
                                STATUS_BLOCK[booking.status],
                              )}
                              style={{
                                top: `${pct(s)}%`,
                                height: `calc(${((e - s) / totalMin) * 100}% - 2px)`,
                                minHeight: 18,
                                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                width: `calc(${100 / lanes}% - 4px)`,
                              }}
                            >
                              <span
                                className={cn(
                                  "block truncate text-[11px] font-medium leading-tight",
                                  compact && "text-[10px]",
                                )}
                              >
                                {fmt.time(booking.start_time)} {booking.customer_name}
                              </span>
                              {!compact && (
                                <span className="block truncate text-[11px] leading-tight opacity-70">
                                  {booking.services?.name ?? t("booking.deletedService")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* legjenda */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5">
        {(
          [
            "confirmed",
            "completed",
            "no_show",
            "cancelled",
          ] as const
        ).map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
            {fmt.status(status)}
          </span>
        ))}
      </div>
    </div>
  );
}
