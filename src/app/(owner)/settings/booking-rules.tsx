"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useFormat, useT } from "@/lib/i18n/provider";
import { useReadOnly } from "../read-only";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DateSelect } from "@/components/date-select";
import { TimeSelect, timeOptions } from "@/components/time-select";
import { todayInTirane } from "@/lib/availability";
import { addClosure, removeClosure, updateBookingRules } from "@/lib/owner-actions";
import type { DictKey } from "@/lib/i18n/sq";
import type { Closure } from "@/lib/types";

const BUFFER_PRESETS = [0, 5, 10, 15, 30];
/** Etiketa është çelës fjalori; `vars` mbush numrat aty ku duhen. */
const NOTICE_PRESETS: { minutes: number; label: DictKey; vars?: Record<string, number> }[] = [
  { minutes: 0, label: "rules.noLimit" },
  { minutes: 30, label: "rules.minutes", vars: { count: 30 } },
  { minutes: 60, label: "rules.hourOne" },
  { minutes: 180, label: "rules.hours", vars: { count: 3 } },
  { minutes: 1440, label: "rules.dayOne" },
];
const WINDOW_PRESETS = [7, 14, 30, 60];

/** Pushimi lëviz me hapa 15-minutësh; ora e drekës rrallë bie te gjysma. */
const BREAK_TIMES = timeOptions(15);

export function BookingRules({
  bufferMinutes,
  minNoticeMinutes,
  bookingWindowDays,
  breakStart,
  breakEnd,
  closures,
}: {
  bufferMinutes: number;
  minNoticeMinutes: number;
  bookingWindowDays: number;
  breakStart: string | null;
  breakEnd: string | null;
  closures: Closure[];
}) {
  const router = useRouter();

  const [buffer, setBuffer] = useState(bufferMinutes);
  const [notice, setNotice] = useState(minNoticeMinutes);
  const [windowDays, setWindowDays] = useState(bookingWindowDays);
  const [hasBreak, setHasBreak] = useState(Boolean(breakStart && breakEnd));
  const [start, setStart] = useState(breakStart ?? "13:00");
  const [end, setEnd] = useState(breakEnd ?? "14:00");
  const [saving, setSaving] = useState(false);

  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const readOnly = useReadOnly();
  const t = useT();
  const fmt = useFormat();

  async function saveRules() {
    setSaving(true);
    const result = await updateBookingRules({
      bufferMinutes: buffer,
      minNoticeMinutes: notice,
      bookingWindowDays: windowDays,
      breakStart: hasBreak ? start : null,
      breakEnd: hasBreak ? end : null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("rules.saved"));
    router.refresh();
  }

  function submitClosure() {
    if (!newDate) {
      toast.error(t("rules.pickDate"));
      return;
    }
    startTransition(async () => {
      const result = await addClosure({ date: newDate, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("rules.closureAdded", { date: fmt.dayMonth(newDate) }));
      setNewDate("");
      setReason("");
      router.refresh();
    });
  }

  function drop(closure: Closure) {
    setBusyId(closure.id);
    startTransition(async () => {
      const result = await removeClosure(closure.id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("rules.closureRemoved"));
      router.refresh();
    });
  }

  return (
    <>
      {/* --------------------------------------------------------- rregullat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rules.title")}</CardTitle>
          <CardDescription>
            {t("rules.hint")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Choice
            label={t("rules.buffer")}
            hint={t("rules.bufferHint")}
            options={BUFFER_PRESETS.map((m) => ({
              value: m,
              label: m === 0 ? t("rules.noBuffer") : `${m} min`,
            }))}
            value={buffer}
            onChange={setBuffer}
            disabled={saving || readOnly}
          />

          <Choice
            label={t("rules.notice")}
            hint={t("rules.noticeHint")}
            options={NOTICE_PRESETS.map((n) => ({ value: n.minutes, label: t(n.label, n.vars) }))}
            value={notice}
            onChange={setNotice}
            disabled={saving || readOnly}
          />

          <Choice
            label={t("rules.window")}
            hint={t("rules.windowHint")}
            options={WINDOW_PRESETS.map((d) => ({ value: d, label: t("rules.windowDays", { count: d }) }))}
            value={windowDays}
            onChange={setWindowDays}
            disabled={saving || readOnly}
          />

          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="break-toggle">{t("rules.lunch")}</Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("rules.lunchHint")}
                </p>
              </div>
              <Switch
                id="break-toggle"
                checked={hasBreak}
                onCheckedChange={setHasBreak}
                disabled={saving || readOnly}
              />
            </div>

            {hasBreak && (
              <div className="flex items-center gap-2">
                <TimeSelect
                  label={t("rules.lunchStart")}
                  value={start}
                  disabled={saving || readOnly}
                  options={BREAK_TIMES}
                  onChange={(next) => {
                    setStart(next);
                    if (end <= next) setEnd(BREAK_TIMES.find((t) => t > next) ?? next);
                  }}
                  className="w-[6.5rem]"
                />
                <span className="text-muted-foreground">–</span>
                <TimeSelect
                  label={t("rules.lunchEnd")}
                  value={end}
                  disabled={saving || readOnly}
                  options={BREAK_TIMES.filter((t) => t > start)}
                  onChange={setEnd}
                  className="w-[6.5rem]"
                />
              </div>
            )}
          </div>

          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              {t("suspended.rules")}
            </p>
          ) : (
            <Button onClick={saveRules} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("rules.save")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- ditët e mbyllura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rules.closuresTitle")}</CardTitle>
          <CardDescription>
            {t("rules.closuresHint")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!readOnly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <DateSelect
              label={t("rules.closureDate")}
              value={newDate}
              min={todayInTirane()}
              onChange={setNewDate}
              disabled={pending}
              className="sm:w-56"
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("rules.closureReason")}
              maxLength={120}
              disabled={pending}
              className="flex-1"
            />
            <Button onClick={submitClosure} disabled={pending || !newDate} className="shrink-0">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.add")}
            </Button>
          </div>
          )}

          {closures.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <CalendarOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("rules.noClosures")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{fmt.dayMonth(c.closed_on)}</p>
                    {c.reason && (
                      <p className="truncate text-sm text-muted-foreground">{c.reason}</p>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => drop(c)}
                      disabled={pending && busyId === c.id}
                      aria-label={t("rules.removeClosure")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {pending && busyId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Choice({
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
