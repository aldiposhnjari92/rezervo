"use client";

import { ChevronDown } from "lucide-react";

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
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-border bg-background pl-3 pr-8",
          "text-sm tabular-nums transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {/* Një vlerë e ruajtur më parë mund të mos bjerë në hapat e tanishëm. */}
        {!options.includes(value) && <option value={value}>{value}</option>}
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
