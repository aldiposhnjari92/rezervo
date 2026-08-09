"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkingHoursEditor, validateWorkingHours } from "@/components/working-hours-editor";
import { PageHeader } from "@/components/page-header";
import { isValidAlbanianPhone } from "@/lib/phone";
import type { WorkingHours } from "@/lib/types";
import { updateBusiness } from "@/lib/actions";

export function SettingsForm({
  name: initialName,
  slug,
  phone: initialPhone,
  workingHours: initialHours,
  children,
}: {
  name: string;
  slug: string;
  phone: string;
  workingHours: WorkingHours;
  /** Rregullat e rezervimit dhe ditët e mbyllura — server components. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [hours, setHours] = useState<WorkingHours>(initialHours);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name.trim().length < 2) {
      toast.error("Shkruaj emrin e biznesit.");
      return;
    }
    if (phone.trim() && !isValidAlbanianPhone(phone)) {
      toast.error("Numri i telefonit nuk është i saktë. Shembull: 069 123 4567");
      return;
    }

    const hoursError = validateWorkingHours(hours);
    if (hoursError) {
      toast.error(hoursError);
      return;
    }

    setSaving(true);
    const result = await updateBusiness({ name, phone, workingHours: hours });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Ndryshimet u ruajtën.");
    router.refresh();
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
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Rregullimet"
        description="Të dhënat e biznesit dhe orari që shohin klientët."
      />

      {/* ------------------------------------------------------------- linku */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linku yt publik</CardTitle>
          <CardDescription>Ndaje këtë link në Instagram, WhatsApp ose Facebook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="break-all rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-sm">
            rezervo.al/<span className="font-semibold text-primary">{slug}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="flex-1">
              <Copy className="h-4 w-4" />
              Kopjo
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={`/${slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Hape
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- të dhënat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Të dhënat e biznesit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Emri i biznesit</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-phone">
              Telefoni <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="settings-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="069 123 4567"
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------- orari */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orari i punës</CardTitle>
          <CardDescription>
            Ndryshimet prekin vetëm rezervimet e reja, jo ato ekzistuese.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkingHoursEditor value={hours} onChange={setHours} disabled={saving} />
        </CardContent>
      </Card>

      {children}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Llogaria ime</CardTitle>
          <CardDescription>Email, fjalëkalim dhe fshirje e llogarisë.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/account">
              <UserRound className="h-4 w-4" />
              Hap llogarinë
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* mbi shiritin e navigimit në telefon */}
      <div className="sticky bottom-20 lg:bottom-4">
        <Button size="lg" className="w-full shadow-lg" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Ruaj të dhënat dhe orarin
        </Button>
      </div>
    </div>
  );
}
