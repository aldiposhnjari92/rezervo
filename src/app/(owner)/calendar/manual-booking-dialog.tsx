"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { formatDuration, formatPrice, tiraneInstant, todayInTirane } from "@/lib/availability";
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
      toast.error("Shto fillimisht një shërbim.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Shkruaj emrin e klientit.");
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      toast.error("Ora nuk është e vlefshme.");
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
          <DialogTitle>Rezervim i ri</DialogTitle>
          <DialogDescription>
            Për klientët që telefonojnë ose vijnë direkt. Orari i punës nuk zbatohet këtu —
            ti vendos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Shërbimi</Label>
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
                      {formatDuration(s.duration_minutes)} · {formatPrice(s.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mb-date">Data</Label>
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
              <Label htmlFor="mb-time">Ora</Label>
              <TimeSelect
                label="Ora e rezervimit"
                value={time}
                disabled={saving}
                options={SLOT_TIMES}
                onChange={setTime}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-name">Emri i klientit</Label>
            <Input
              id="mb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p.sh. Ana Hoxha"
              maxLength={80}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-phone">
              Telefoni <span className="font-normal text-muted-foreground">(opsional)</span>
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
              Shënim <span className="font-normal text-muted-foreground">(opsional)</span>
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
            Anulo
          </Button>
          <Button onClick={submit} disabled={saving || services.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Shto rezervimin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
