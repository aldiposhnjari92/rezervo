"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useReadOnly } from "../read-only";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimeSelect, timeOptions } from "@/components/time-select";
import { formatDayMonth, todayInTirane } from "@/lib/availability";
import { addClosure, removeClosure, updateBookingRules } from "@/lib/owner-actions";
import type { Closure } from "@/lib/types";

const BUFFER_PRESETS = [0, 5, 10, 15, 30];
const NOTICE_PRESETS = [
  { minutes: 0, label: "Pa kufi" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 orë" },
  { minutes: 180, label: "3 orë" },
  { minutes: 1440, label: "1 ditë" },
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
    toast.success("Rregullat u ruajtën.");
    router.refresh();
  }

  function submitClosure() {
    if (!newDate) {
      toast.error("Zgjidh një datë.");
      return;
    }
    startTransition(async () => {
      const result = await addClosure({ date: newDate, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${formatDayMonth(newDate)} u shënua si e mbyllur.`);
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
      toast.success("Data u hoq.");
      router.refresh();
    });
  }

  return (
    <>
      {/* --------------------------------------------------------- rregullat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rregullat e rezervimit</CardTitle>
          <CardDescription>
            Vlejnë vetëm për rezervimet online. Ti mund të shtosh gjithmonë me dorë.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Choice
            label="Pushim mes takimeve"
            hint="Kohë për të pastruar ose përgatitur para klientit tjetër."
            options={BUFFER_PRESETS.map((m) => ({
              value: m,
              label: m === 0 ? "Pa pushim" : `${m} min`,
            }))}
            value={buffer}
            onChange={setBuffer}
            disabled={saving || readOnly}
          />

          <Choice
            label="Njoftimi minimal"
            hint="Sa përpara duhet rezervuar. Të ndalon rezervimet 'për tani'."
            options={NOTICE_PRESETS.map((n) => ({ value: n.minutes, label: n.label }))}
            value={notice}
            onChange={setNotice}
            disabled={saving || readOnly}
          />

          <Choice
            label="Sa përpara mund të rezervohet"
            hint="Sa ditë shfaqen te faqja publike."
            options={WINDOW_PRESETS.map((d) => ({ value: d, label: `${d} ditë` }))}
            value={windowDays}
            onChange={setWindowDays}
            disabled={saving || readOnly}
          />

          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="break-toggle">Pushimi i ditës</Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  P.sh. dreka. Zbatohet çdo ditë pune.
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
                  label="Fillimi i pushimit"
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
                  label="Fundi i pushimit"
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
              Llogaria është e pezulluar, ndaj rregullat nuk ndryshohen dot.
            </p>
          ) : (
            <Button onClick={saveRules} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Ruaj rregullat
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- ditët e mbyllura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ditë të mbyllura</CardTitle>
          <CardDescription>
            Festa ose pushime. Ato ditë zhduken nga faqia publike.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!readOnly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="date"
              value={newDate}
              min={todayInTirane()}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={pending}
              className="h-11 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Arsyeja (opsionale)"
              maxLength={120}
              disabled={pending}
              className="flex-1"
            />
            <Button onClick={submitClosure} disabled={pending || !newDate} className="shrink-0">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Shto
            </Button>
          </div>
          )}

          {closures.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <CalendarOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Asnjë ditë e mbyllur</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatDayMonth(c.closed_on)}</p>
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
                      aria-label="Hiq"
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
