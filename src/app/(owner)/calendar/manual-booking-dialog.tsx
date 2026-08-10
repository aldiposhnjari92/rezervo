"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useFormat, useT } from "@/lib/i18n/provider";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSelect, timeOptions } from "@/components/time-select";
import { tiraneInstant, todayInTirane } from "@/lib/availability";
import { createManualBooking } from "@/lib/owner-actions";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Pronari mund të vendosë çdo orë; hapat 15-minutësh mbulojnë çdo rast real. */
const SLOT_TIMES = timeOptions(15);

export function ManualBookingDialog({
  open,
  onOpenChange,
  services,
  defaultDate,
  defaultTime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price">[];
  defaultDate: string;
  defaultTime?: string;
}) {
  const router = useRouter();
  const t = useT();
  const fmt = useFormat();

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "10:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setPhone("");
    setNote("");
    setTime(defaultTime ?? "10:00");
    setDate(defaultDate);
  }

  async function submit() {
    if (!serviceId) {
      toast.error(t("manual.noServices"));
      return;
    }
    if (name.trim().length < 2) {
      toast.error(t("err.customerName"));
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      toast.error(t("err.time"));
      return;
    }

    setSaving(true);
    const result = await createManualBooking({
      serviceId,
      customerName: name,
      customerPhone: phone,
      startTime: tiraneInstant(date, time).toISOString(),
      note,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Rezervimi për ${name.trim()} u shtua.`);
    reset();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("manual.title")}</DialogTitle>
          <DialogDescription>
            Për klientët që telefonojnë ose vijnë direkt. Orari i punës nuk zbatohet këtu —
            ti vendos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("manual.service")}</Label>
            {services.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Ende asnjë shërbim aktiv.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      serviceId === s.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmt.duration(s.duration_minutes)} · {fmt.price(s.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mb-date">{t("manual.date")}</Label>
              <input
                id="mb-date"
                type="date"
                value={date}
                min={todayInTirane()}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-time">{t("manual.time")}</Label>
              <TimeSelect
                label={t("manual.time")}
                value={time}
                disabled={saving}
                options={SLOT_TIMES}
                onChange={setTime}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-name">{t("manual.customerName")}</Label>
            <Input
              id="mb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("manual.customerNamePlaceholder")}
              maxLength={80}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-phone">
              {t("manual.phone")}{" "}
              <span className="font-normal text-muted-foreground">{t("common.optional")}</span>
            </Label>
            <Input
              id="mb-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="069 123 4567"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Lëre bosh për një klient që erdhi pa lajmëruar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-note">
              {t("manual.note")}{" "}
              <span className="font-normal text-muted-foreground">{t("common.optional")}</span>
            </Label>
            <Input
              id="mb-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="p.sh. do vijë me djalin"
              maxLength={300}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving || services.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("manual.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
