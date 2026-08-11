"use client";

import { ChevronDown } from "lucide-react";

import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

/**
 * Zgjedhës ore 24-orësh.
 *
 * Zëvendëson `<input type="time">`, i cili i shfaq orët sipas gjuhës së
 * shfletuesit: një përdorues me shfletues në anglisht shihte "09:00 AM / 06:00 PM"
 * ndërsa i gjithë aplikacioni tregon 24-orësh. Një listë e fiksuar e heq atë
 * mospërputhje dhe e bën të pamundur shkrimin e një ore të pavlefshme.
 */
export function timeOptions(stepMinutes: 15 | 30 = 30): string[] {
  const count = (24 * 60) / stepMinutes;
  return Array.from({ length: count }, (_, i) => {
    const total = i * stepMinutes;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
}

export function TimeSelect({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  /**
   * Një orar i ruajtur më parë mund të mos bjerë në hapat e tanishëm (p.sh.
   * "09:20" kur lista shkon nga 15 në 15). Ora e tanishme hyn në listë në vendin
   * e vet — "HH:MM" renditet si tekst njësoj si në kohë.
   */
  const times = options.includes(value) ? options : [...options, value].sort();

  return (
    <Dropdown
      className={className}
      panelClassName="left-0 min-w-full"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-border bg-background pl-3 pr-2.5",
            "text-sm tabular-nums transition-colors hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-ring",
          )}
        >
          {value}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {({ close }) => (
        // Lista e orëve është e gjatë; panelin e mban të shkurtër vetë rrëshqitja.
        <div className="max-h-64 overflow-y-auto">
          {times.map((time) => (
            <DropdownItem
              key={time}
              selected={time === value}
              className="tabular-nums"
              onSelect={() => {
                close();
                onChange(time);
              }}
            >
              {time}
            </DropdownItem>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
