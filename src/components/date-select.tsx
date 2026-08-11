"use client";

import { CalendarDays } from "lucide-react";

import { MonthCalendar } from "@/components/month-calendar";
import { Popover } from "@/components/ui/dropdown";
import { useFormat, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Zgjedhës date.
 *
 * Zëvendëson `input[type="date"]`, që e vizaton sistemi operativ: në Chrome të
 * errët hapej kalendar i bardhë, dhe teksti i fushës vinte në formatin e
 * shfletuesit ("8/22/2026" për një përdorues me shfletues në anglisht) ndërsa i
 * gjithë aplikacioni shkruan "22 Gusht". Kalendari ynë ndjek gjuhën e zgjedhur
 * dhe temën, njësoj si zgjedhësi i orës.
 */
export function DateSelect({
  value,
  onChange,
  min,
  max,
  label,
  id,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Kufij përfshirës, "yyyy-MM-dd". */
  min?: string;
  max?: string;
  label: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const fmt = useFormat();

  return (
    <Popover
      className={className}
      panelClassName="left-0 w-[19rem] max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          id={id}
          onClick={toggle}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-base",
            "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
            open && "ring-2 ring-ring",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">
            {value ? fmt.dayMonthYear(value) : t("calendar.pickDate")}
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <MonthCalendar
          className="p-1"
          value={value}
          min={min}
          max={max}
          autoFocus
          onPick={(date) => {
            close();
            onChange(date);
          }}
        />
      )}
    </Popover>
  );
}
