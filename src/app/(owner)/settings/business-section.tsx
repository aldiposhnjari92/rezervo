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
import { useT } from "@/lib/i18n/provider";

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
  const t = useT();

  const dirty = name !== initialName || phone !== initialPhone;

  async function copyLink() {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("services.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(url);
    }
  }

  async function save() {
    if (name.trim().length < 2) {
      toast.error(t("setup.nameRequired"));
      return;
    }
    if (phone.trim() && !isValidAlbanianPhone(phone)) {
      toast.error(t("err.phone"));
      return;
    }

    setSaving(true);
    const result = await updateBusiness({ name, phone, workingHours });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t("settings.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.publicLink")}</CardTitle>
          <CardDescription>{t("settings.publicLinkHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="break-all rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-sm">
            rezervo.al/<span className="font-semibold text-primary">{slug}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={`/${slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("common.open")}
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.linkFixed")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.businessData")}</CardTitle>
          <CardDescription>{t("settings.businessDataHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">{t("settings.businessName")}</Label>
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
              {t("settings.phone")}{" "}
              <span className="font-normal text-muted-foreground">{t("common.optional")}</span>
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
              {t("settings.phoneHint")}
            </p>
          </div>

          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              {t("suspended.fields")}
            </p>
          ) : (
            <Button onClick={save} disabled={saving || !dirty}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dirty ? t("settings.saveBusiness") : t("common.nothingToSave")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
