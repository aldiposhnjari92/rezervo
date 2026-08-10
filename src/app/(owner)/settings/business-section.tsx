"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidAlbanianPhone } from "@/lib/phone";
import type { WorkingHours } from "@/lib/types";
import { updateBusiness } from "@/lib/actions";
import { useReadOnly } from "../read-only";

/**
 * Emri, telefoni dhe linku publik.
 *
 * Orari i punës dërgohet i pandryshuar bashkë me këto: `updateBusiness` i pret
 * të tria së bashku, dhe skeda tjetër i ruan të vetat në të njëjtën mënyrë.
 * Meqë skedat janë faqe të veçanta, secila niset nga vlerat e freskëta të
 * serverit — asgjë nuk mbishkruhet me një gjendje të vjetruar.
 */
export function BusinessSection({
  name: initialName,
  slug,
  phone: initialPhone,
  workingHours,
}: {
  name: string;
  slug: string;
  phone: string;
  workingHours: WorkingHours;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const readOnly = useReadOnly();

  const dirty = name !== initialName || phone !== initialPhone;

  async function copyLink() {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Linku u kopjua!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(url);
    }
  }

  async function save() {
    if (name.trim().length < 2) {
      toast.error("Shkruaj emrin e biznesit.");
      return;
    }
    if (phone.trim() && !isValidAlbanianPhone(phone)) {
      toast.error("Numri i telefonit nuk është i saktë. Shembull: 069 123 4567");
      return;
    }

    setSaving(true);
    const result = await updateBusiness({ name, phone, workingHours });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Të dhënat u ruajtën.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linku yt publik</CardTitle>
          <CardDescription>Ndaje në Instagram, WhatsApp ose Facebook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="break-all rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-sm">
            rezervo.al/<span className="font-semibold text-primary">{slug}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "U kopjua" : "Kopjo"}
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={`/${slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Hape
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Linku nuk ndryshohet dot pasi krijohet dyqani.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Të dhënat e biznesit</CardTitle>
          <CardDescription>Emri shfaqet te faqja publike e rezervimit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Emri i biznesit</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={saving || readOnly}
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
              disabled={saving || readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Shfaqet te faqja e konfirmimit, që klienti të të gjejë nëse i duhet.
            </p>
          </div>

          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              Llogaria është e pezulluar, ndaj këto fusha nuk ndryshohen dot.
            </p>
          ) : (
            <Button onClick={save} disabled={saving || !dirty}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dirty ? "Ruaj të dhënat" : "Asgjë për të ruajtur"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
