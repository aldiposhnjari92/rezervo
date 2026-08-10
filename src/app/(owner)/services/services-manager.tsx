"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useReadOnly } from "../read-only";
import { formatDuration, formatPrice } from "@/lib/availability";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createService, deleteService, setServiceActive, updateService } from "@/lib/actions";

/** Kohëzgjatjet më të zakonshme — shmangin shkrimin manual në telefon. */
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

type Draft = { id?: string; name: string; duration: number; price: string };

const EMPTY_DRAFT: Draft = { name: "", duration: 30, price: "" };

export function ServicesManager({
  services,
  showWelcome,
  slug,
}: {
  services: Service[];
  showWelcome: boolean;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const readOnly = useReadOnly();

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  }

  function openEdit(service: Service) {
    setDraft({
      id: service.id,
      name: service.name,
      duration: service.duration_minutes,
      price: String(service.price),
    });
    setOpen(true);
  }

  async function handleSave() {
    const price = Number(draft.price === "" ? 0 : draft.price);

    if (draft.name.trim().length < 2) {
      toast.error("Shkruaj emrin e shërbimit.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Çmimi nuk është i vlefshëm.");
      return;
    }

    setSaving(true);
    const payload = {
      name: draft.name,
      durationMinutes: draft.duration,
      price: Math.round(price),
    };

    const result = draft.id
      ? await updateService({ id: draft.id, ...payload })
      : await createService(payload);

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(draft.id ? "Shërbimi u ruajt." : "Shërbimi u shtua.");
    setOpen(false);
  }

  function toggleActive(service: Service) {
    setBusyId(service.id);
    startTransition(async () => {
      const result = await setServiceActive(service.id, !service.is_active);
      setBusyId(null);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete(service: Service) {
    setBusyId(service.id);
    startTransition(async () => {
      const result = await deleteService(service.id);
      setBusyId(null);
      setConfirmDelete(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Shërbimi u fshi.");
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Linku u kopjua!");
    } catch {
      toast.error(url);
    }
  }

  return (
    <div className="space-y-5">
      {showWelcome && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-medium">Dyqani u krijua 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Shto shërbimet që ofron, pastaj ndaje linkun me klientët.
          </p>
          <Button variant="outline" size="sm" className="mt-3 bg-background" onClick={copyLink}>
            <Copy className="h-4 w-4" />
            Kopjo linkun
          </Button>
        </div>
      )}

      <PageHeader
        title="Shërbimet"
        description={
          services.length
            ? `${services.length} shërbime · ${services.filter((s) => s.is_active).length} aktive`
            : "Ende asnjë shërbim"
        }
        action={
          readOnly ? undefined : (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Shto
            </Button>
          )
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Shto shërbimin tënd të parë"
          description={
            readOnly
              ? "Llogaria është e pezulluar, ndaj shërbime të reja nuk shtohen dot."
              : 'P.sh. "Prerje flokësh" — 30 minuta, 500 Lek.'
          }
          action={
            readOnly ? undefined : (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Shto shërbim
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Tabelë në desktop — njësoj si te klientët dhe te paneli i adminit;
              më parë kjo ishte e vetmja listë që mbetej kartela edhe në ekran
              të gjerë, ndaj gjysma e rreshtit rrinte bosh. */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Shërbimi</th>
                  <th className="px-3 py-3 text-right font-medium">Kohëzgjatja</th>
                  <th className="px-3 py-3 text-right font-medium">Çmimi</th>
                  <th className="px-3 py-3 text-center font-medium">Aktiv</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const isBusy = pending && busyId === service.id;
                  return (
                    <tr
                      key={service.id}
                      className={cn(
                        "border-b border-border transition-colors last:border-0 hover:bg-muted/40",
                        !service.is_active && "text-muted-foreground",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <DurationBadge
                            minutes={service.duration_minutes}
                            active={service.is_active}
                          />
                          <span className="font-medium text-foreground">{service.name}</span>
                          {!service.is_active && <Badge variant="secondary">Joaktiv</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatDuration(service.duration_minutes)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-foreground">
                        {formatPrice(service.price)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-center">
                          {readOnly ? (
                            <Badge variant={service.is_active ? "success" : "secondary"}>
                              {service.is_active ? "Aktiv" : "Joaktiv"}
                            </Badge>
                          ) : (
                            <Switch
                              checked={service.is_active}
                              disabled={isBusy}
                              onCheckedChange={() => toggleActive(service)}
                              aria-label={`Aktiv: ${service.name}`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {readOnly ? null : (
                            <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(service)}
                            aria-label={`Ndrysho ${service.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(service)}
                            aria-label={`Fshi ${service.name}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 lg:hidden">
            {services.map((service) => {
              const isBusy = pending && busyId === service.id;
              return (
                <li
                  key={service.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4",
                    !service.is_active && "opacity-60",
                  )}
                >
                  <DurationBadge
                    minutes={service.duration_minutes}
                    active={service.is_active}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{service.name}</p>
                      {!service.is_active && <Badge variant="secondary">Joaktiv</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatDuration(service.duration_minutes)} · {formatPrice(service.price)}
                    </p>
                  </div>

                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={service.is_active}
                        disabled={isBusy}
                        onCheckedChange={() => toggleActive(service)}
                        aria-label={`Aktiv: ${service.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(service)}
                        aria-label={`Ndrysho ${service.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(service)}
                        aria-label={`Fshi ${service.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ------------------------------------------------- dialogu shto/ndrysho */}
      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Ndrysho shërbimin" : "Shërbim i ri"}</DialogTitle>
            <DialogDescription>
              Kohëzgjatja përcakton sa orë zë ky shërbim në axhendën tënde.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Emri i shërbimit</Label>
              <Input
                id="service-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="p.sh. Prerje flokësh"
                maxLength={80}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Kohëzgjatja</Label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDraft({ ...draft, duration: minutes })}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium transition-colors",
                      draft.duration === minutes
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {formatDuration(minutes)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-price">Çmimi (Lek)</Label>
              <Input
                id="service-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">
                Lëre bosh nëse shërbimi është falas. Pagesa bëhet në dyqan.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Anulo
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Ruaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- dialogu i fshirjes */}
      <Dialog open={Boolean(confirmDelete)} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fshi shërbimin?</DialogTitle>
            <DialogDescription>
              &quot;{confirmDelete?.name}&quot; do të hiqet nga faqja jote. Ky veprim nuk kthehet
              mbrapsht.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Anulo
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Fshi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Kohëzgjatja lexohet me sy përpara emrit — ajo vendos sa zë në axhendë. */
function DurationBadge({ minutes, active }: { minutes: number; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[11px] font-semibold leading-none",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      <span className="tabular-nums">{minutes}</span>
      <span className="mt-0.5 text-[9px] font-medium opacity-70">min</span>
    </span>
  );
}
