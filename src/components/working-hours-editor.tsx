"use client";

import { Copy } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { TimeSelect, timeOptions } from "@/components/time-select";
import { DAY_KEYS, type DayKey, type WorkingHours } from "@/lib/types";
import { useFormat, useT } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/sq";
import { cn } from "@/lib/utils";

const DEFAULT_OPEN = { start: "09:00", end: "18:00" };

const TIME_OPTIONS = timeOptions(30);

/** Skemat më të zakonshme, që të mos preken 12 fusha një nga një. */
const PRESETS: { label: DictKey; hours: WorkingHours }[] = [
  {
    label: "hours.presetWeekdays",
    hours: buildHours({ weekdays: ["09:00", "18:00"], saturday: null, sunday: null }),
  },
  {
    label: "hours.presetSix",
    hours: buildHours({ weekdays: ["09:00", "19:00"], saturday: ["09:00", "19:00"], sunday: null }),
  },
  {
    label: "hours.presetEveryDay",
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
  const t = useT();
  const fmt = useFormat();
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
        <span className="text-xs font-medium text-muted-foreground">{t("hours.startFrom")}</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.hours)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/25 hover:bg-muted disabled:opacity-50"
          >
            {t(preset.label)}
          </button>
        ))}
      </div>

      {/*
        Pa `overflow-hidden`: brenda rreshtave hapen menytë e orëve, dhe një
        prind që pret do t'i priste ato në gjysmë. Qoshet i rrumbullakos secila
        pjesë vetë — koka lart, rreshti i fundit poshtë.
      */}
      <div className="rounded-2xl border border-border">
        {/* koka: një veprim i vetëm, jo një për çdo rresht */}
        <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {openCount === 0
              ? t("hours.noWorkDays")
              : t("hours.daysPerWeek", { count: openCount })}
          </span>

          {template && openCount > 1 && (
            <button
              type="button"
              onClick={applyToAll}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("hours.applyToAll", { start: template.start, end: template.end })}
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
                  "last:rounded-b-2xl",
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
                  {fmt.day(day)}
                </label>

                {isOpen && hours ? (
                  <div className="flex flex-1 items-center gap-2">
                    <div className="w-[6.5rem]">
                      <TimeSelect
                        label={t("hours.openLabel", { day: fmt.day(day) })}
                        value={hours.start}
                        disabled={disabled}
                        options={TIME_OPTIONS}
                        onChange={(start) => setStart(day, start)}
                      />
                    </div>

                    <span className="text-muted-foreground">–</span>

                    <div className="w-[6.5rem]">
                      <TimeSelect
                        label={t("hours.closeLabel", { day: fmt.day(day) })}
                        value={hours.end}
                        disabled={disabled}
                        // Vetëm orët pas hapjes: një orar i pavlefshëm nuk zgjidhet dot.
                        options={TIME_OPTIONS.filter((t) => t > hours.start)}
                        onChange={(end) => setDay(day, { ...hours, end })}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("hours.closed")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Kontroll në klient që pasqyron atë të serverit — për të shmangur një round-trip.
 *
 * `t` dhe `fmt` merren si argumente e nuk thirren si hook brenda: kjo nuk është
 * komponent, dhe thirret nga dy vende që i kanë tashmë të dyja.
 */
export function validateWorkingHours(
  value: WorkingHours,
  t: (key: DictKey, vars?: Record<string, string | number>) => string,
  fmt: { day: (key: DayKey) => string },
): string | null {
  const anyOpen = DAY_KEYS.some((day) => value[day]);
  if (!anyOpen) return t("hours.pickOneDay");

  for (const day of DAY_KEYS) {
    const hours = value[day];
    if (!hours) continue;
    if (!hours.start || !hours.end) return t("hours.fillDay", { day: fmt.day(day) });
    if (hours.end <= hours.start) return t("hours.orderDay", { day: fmt.day(day) });
  }

  return null;
}
