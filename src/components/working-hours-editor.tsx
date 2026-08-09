"use client";

import { Copy } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { TimeSelect, timeOptions } from "@/components/time-select";
import { DAY_KEYS, DAY_LABELS_SQ, type DayKey, type WorkingHours } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_OPEN = { start: "09:00", end: "18:00" };

const TIME_OPTIONS = timeOptions(30);

/** Skemat më të zakonshme, që të mos preken 12 fusha një nga një. */
const PRESETS: { label: string; hours: WorkingHours }[] = [
  {
    label: "Hën–Pre, 09:00–18:00",
    hours: buildHours({ weekdays: ["09:00", "18:00"], saturday: null, sunday: null }),
  },
  {
    label: "Hën–Sht, 09:00–19:00",
    hours: buildHours({ weekdays: ["09:00", "19:00"], saturday: ["09:00", "19:00"], sunday: null }),
  },
  {
    label: "Çdo ditë, 10:00–20:00",
    hours: buildHours({
      weekdays: ["10:00", "20:00"],
      saturday: ["10:00", "20:00"],
      sunday: ["10:00", "20:00"],
    }),
  },
];

function buildHours(spec: {
  weekdays: [string, string];
  saturday: [string, string] | null;
  sunday: [string, string] | null;
}): WorkingHours {
  return {
    monday: { start: spec.weekdays[0], end: spec.weekdays[1] },
    tuesday: { start: spec.weekdays[0], end: spec.weekdays[1] },
    wednesday: { start: spec.weekdays[0], end: spec.weekdays[1] },
    thursday: { start: spec.weekdays[0], end: spec.weekdays[1] },
    friday: { start: spec.weekdays[0], end: spec.weekdays[1] },
    saturday: spec.saturday ? { start: spec.saturday[0], end: spec.saturday[1] } : null,
    sunday: spec.sunday ? { start: spec.sunday[0], end: spec.sunday[1] } : null,
  };
}

export function WorkingHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: WorkingHours;
  onChange: (next: WorkingHours) => void;
  disabled?: boolean;
}) {
  const firstOpen = DAY_KEYS.find((day) => value[day]);
  const template = firstOpen ? value[firstOpen] : null;
  const openCount = DAY_KEYS.filter((day) => value[day]).length;

  function setDay(day: DayKey, next: WorkingHours[DayKey]) {
    onChange({ ...value, [day]: next });
  }

  /**
   * Kopjon orarin e ditës së parë të hapur te të gjitha ditët e tjera të hapura.
   * Më parë ky veprim ishte i përsëritur në çdo rresht — gjashtë linqe identike
   * njëri poshtë tjetrit, dhe asnjëri i dukshëm në telefon.
   */
  function applyToAll() {
    if (!template) return;
    const next = { ...value };
    for (const day of DAY_KEYS) {
      if (next[day]) next[day] = { ...template };
    }
    onChange(next);
  }

  /** Fundi duhet të jetë gjithmonë pas fillimit; e sigurojmë duke e kufizuar listën. */
  function setStart(day: DayKey, start: string) {
    const current = value[day];
    if (!current) return;
    const end = current.end > start ? current.end : (TIME_OPTIONS.find((t) => t > start) ?? start);
    setDay(day, { start, end });
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ shpejt */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Nis nga:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.hours)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/25 hover:bg-muted disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        {/* koka: një veprim i vetëm, jo një për çdo rresht */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {openCount === 0
              ? "Asnjë ditë pune"
              : `${openCount} ditë pune në javë`}
          </span>

          {template && openCount > 1 && (
            <button
              type="button"
              onClick={applyToAll}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Vendos {template.start}–{template.end} te të gjitha
            </button>
          )}
        </div>

        <div className="divide-y divide-border">
          {DAY_KEYS.map((day) => {
            const hours = value[day];
            const isOpen = Boolean(hours);

            return (
              <div
                key={day}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors",
                  !isOpen && "bg-muted/20",
                )}
              >
                <Switch
                  id={`switch-${day}`}
                  checked={isOpen}
                  disabled={disabled}
                  onCheckedChange={(checked) => setDay(day, checked ? { ...DEFAULT_OPEN } : null)}
                />

                <label
                  htmlFor={`switch-${day}`}
                  className={cn(
                    "w-20 shrink-0 cursor-pointer select-none text-sm font-medium",
                    !isOpen && "text-muted-foreground",
                  )}
                >
                  {DAY_LABELS_SQ[day]}
                </label>

                {isOpen && hours ? (
                  <div className="flex flex-1 items-center gap-2">
                    <div className="w-[6.5rem]">
                      <TimeSelect
                        label={`Hapja, ${DAY_LABELS_SQ[day]}`}
                        value={hours.start}
                        disabled={disabled}
                        options={TIME_OPTIONS}
                        onChange={(start) => setStart(day, start)}
                      />
                    </div>

                    <span className="text-muted-foreground">–</span>

                    <div className="w-[6.5rem]">
                      <TimeSelect
                        label={`Mbyllja, ${DAY_LABELS_SQ[day]}`}
                        value={hours.end}
                        disabled={disabled}
                        // Vetëm orët pas hapjes: një orar i pavlefshëm nuk zgjidhet dot.
                        options={TIME_OPTIONS.filter((t) => t > hours.start)}
                        onChange={(end) => setDay(day, { ...hours, end })}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Mbyllur</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
    if (!hours.start || !hours.end) return `Plotëso orarin për ditën "${DAY_LABELS_SQ[day]}".`;
    if (hours.end <= hours.start)
      return `Te "${DAY_LABELS_SQ[day]}" ora e mbylljes duhet të jetë pas asaj të hapjes.`;
  }

  return null;
}
