"use client";

import { Switch } from "@/components/ui/switch";
import { DAY_KEYS, DAY_LABELS_SQ, type DayKey, type WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_OPEN = { start: "09:00", end: "18:00" };

export function WorkingHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
  disabled?: boolean;
}) {
  function setDay(day: DayKey, next: WorkingHours[DayKey]) {
    onChange({ ...value, [day]: next });
  }

  /** Kopjon orarin e ditës së parë të hapur në të gjitha ditët e tjera të hapura. */
  function applyToAll(day: DayKey) {
    const source = value[day];
    if (!source) return;
    const next = { ...value };
    for (const key of DAY_KEYS) {
      if (next[key]) next[key] = { ...source };
    }
    onChange(next);
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {DAY_KEYS.map((day) => {
        const hours = value[day];
        const isOpen = Boolean(hours);

        return (
          <div key={day} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-3 sm:w-44">
              <label
                htmlFor={`switch-${day}`}
                className={cn("text-sm font-medium", !isOpen && "text-muted-foreground")}
              >
                {DAY_LABELS_SQ[day]}
              </label>
              <Switch
                id={`switch-${day}`}
                checked={isOpen}
                disabled={disabled}
                onCheckedChange={(checked) => setDay(day, checked ? { ...DEFAULT_OPEN } : null)}
              />
            </div>

            {isOpen && hours ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="time"
                  step={1800}
                  value={hours.start}
                  disabled={disabled}
                  onChange={(e) => setDay(day, { ...hours, start: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:text-sm"
                />
                <span className="text-muted-foreground">—</span>
                <input
                  type="time"
                  step={1800}
                  value={hours.end}
                  disabled={disabled}
                  onChange={(e) => setDay(day, { ...hours, end: e.target.value })}
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:text-sm"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => applyToAll(day)}
                  className="ml-auto hidden shrink-0 text-xs text-primary hover:underline sm:block"
                >
                  Vendos te të gjitha
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Mbyllur</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Kontroll në klient që pasqyron atë të serverit — për të shmangur një round-trip. */
export function validateWorkingHours(value: WorkingHours): string | null {
  const anyOpen = DAY_KEYS.some((day) => value[day]);
  if (!anyOpen) return "Zgjidh të paktën një ditë pune.";

  for (const day of DAY_KEYS) {
    const hours = value[day];
    if (!hours) continue;
    if (!hours.start || !hours.end)
      return `Plotëso orarin për ditën "${DAY_LABELS_SQ[day]}".`;
    if (hours.end <= hours.start)
      return `Te "${DAY_LABELS_SQ[day]}" ora e mbylljes duhet të jetë pas asaj të hapjes.`;
  }

  return null;
}
