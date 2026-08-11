"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { focusCell } from "@/components/ui/dropdown";
import { addDaysToDate, todayInTirane } from "@/lib/availability";
import { addMonths, isSameMonth, monthGrid, startOfMonth } from "@/lib/calendar";
import { useFormat, useT } from "@/lib/i18n/provider";
import { DAY_KEYS } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Rrjeta e një muaji, e përbashkët për fushën e datës dhe faqen publike.
 *
 * Vjen nga `lib/calendar` — e njëjta që vizaton kalendarin e pronarit, e mbuluar
 * tashmë nga testet: javët nisin të hënën dhe muajt e shkurtër nuk lënë rresht
 * bosh. Një rrjetë e dytë do të thoshte dy vende ku prishet e njëjta gjë.
 */
export function MonthCalendar({
  value,
  onPick,
  min,
  max,
  isUnavailable,
  autoFocus = false,
  showToday = true,
  className,
}: {
  /** Data e zgjedhur, "yyyy-MM-dd". Bosh do të thotë asnjë. */
  value: string;
  onPick: (date: string) => void;
  /** Kufij përfshirës. */
  min?: string;
  max?: string;
  /** Rregull shtesë përtej kufijve — p.sh. ditë e mbyllur ose pa vende. */
  isUnavailable?: (date: string) => boolean;
  autoFocus?: boolean;
  showToday?: boolean;
  className?: string;
}) {
  const t = useT();
  const fmt = useFormat();
  const today = todayInTirane();

  const initial = value || min || today;
  const [month, setMonth] = useState(() => startOfMonth(initial));
  const [focused, setFocused] = useState(initial);
  const gridRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  const days = monthGrid(month);
  const allowed = (date: string) =>
    (!min || date >= min) && (!max || date <= max) && !isUnavailable?.(date);

  // Kur zgjedhja kalon në një muaj tjetër pa dorën e përdoruesit — p.sh. ndërrohet
  // shërbimi dhe dita e parë e lirë bie muajin tjetër — kalendari e ndjek.
  useEffect(() => {
    if (value && !isSameMonth(value, month)) setMonth(startOfMonth(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /**
   * Fokusi ndjek ditën e zgjedhur, por vetëm pasi përdoruesi ka prekur rrjetën:
   * te faqja publike kalendari rri gjithmonë i hapur, dhe një fokus në ngarkim
   * do ta hidhte faqen poshtë te kalendari.
   */
  useEffect(() => {
    if (!autoFocus && !touched.current) return;
    focusCell(gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`));
  }, [focused, month, autoFocus]);

  function move(delta: number) {
    const next = addDaysToDate(focused, delta);
    if ((min && next < min) || (max && next > max)) return;
    touched.current = true;
    if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
    setFocused(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "ArrowDown" ? 7
      : event.key === "ArrowUp" ? -7
      : 0;

    if (!delta) return;
    event.preventDefault();
    move(delta);
  }

  /** Hapi i muajit nuk lejohet të dalë tërësisht jashtë kufijve. */
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <MonthStep
          label={t("calendar.prev")}
          disabled={Boolean(min) && min! >= month}
          onClick={() => setMonth(prevMonth)}
        >
          <ChevronLeft className="h-4 w-4" />
        </MonthStep>

        <span aria-live="polite" className="text-sm font-medium">
          {fmt.monthYear(month)}
        </span>

        <MonthStep
          label={t("calendar.next")}
          disabled={Boolean(max) && max! < nextMonth}
          onClick={() => setMonth(nextMonth)}
        >
          <ChevronRight className="h-4 w-4" />
        </MonthStep>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
        {DAY_KEYS.map((day) => (
          <span key={day} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {fmt.dayShort(day)}
          </span>
        ))}
      </div>

      {/*
        Pa `role="grid"`: një rrjetë e vërtetë kërkon rreshta, kurse këtu qelizat
        rrjedhin njëra pas tjetrës në shtatë shtylla CSS. Çdo ditë e thotë vetë
        datën e plotë, ndaj lexuesi i ekranit nuk humbet gjë.
      */}
      <div ref={gridRef} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-0.5 px-0.5">
        {days.map((date) => {
          const selected = date === value;
          const outside = !isSameMonth(date, month);

          return (
            <button
              key={date}
              type="button"
              data-date={date}
              aria-label={fmt.dayMonthYear(date)}
              aria-pressed={selected}
              aria-current={date === today ? "date" : undefined}
              // Vetëm një qelizë hyn te Tab-i; brenda rrjetës lëvizet me shigjeta.
              tabIndex={date === focused ? 0 : -1}
              disabled={!allowed(date)}
              onClick={() => {
                touched.current = true;
                onPick(date);
              }}
              onFocus={() => setFocused(date)}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-30",
                selected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : cn(
                      "hover:bg-muted",
                      outside ? "text-muted-foreground/60" : "text-foreground",
                      date === today && "font-semibold text-primary",
                    ),
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      {showToday && allowed(today) && (
        <button
          type="button"
          onClick={() => {
            touched.current = true;
            onPick(today);
          }}
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("calendar.today")}
        </button>
      )}
    </div>
  );
}

function MonthStep({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
