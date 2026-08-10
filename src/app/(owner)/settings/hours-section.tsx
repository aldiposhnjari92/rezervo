"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkingHoursEditor, validateWorkingHours } from "@/components/working-hours-editor";
import type { WorkingHours } from "@/lib/types";
import { updateBusiness } from "@/lib/actions";
import { useReadOnly } from "../read-only";
import { useT } from "@/lib/i18n/provider";

export function HoursSection({
  name,
  phone,
  workingHours: initialHours,
}: {
  name: string;
  phone: string;
  workingHours: WorkingHours;
}) {
  const router = useRouter();
  const [hours, setHours] = useState<WorkingHours>(initialHours);
  const [saving, setSaving] = useState(false);
  const readOnly = useReadOnly();
  const t = useT();

  const dirty = JSON.stringify(hours) !== JSON.stringify(initialHours);

  async function save() {
    const error = validateWorkingHours(hours);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    // Emri dhe telefoni dërgohen të pandryshuar — skeda tjetër i zotëron ato.
    const result = await updateBusiness({ name, phone, workingHours: hours });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t("settings.hoursSaved"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.hoursTitle")}</CardTitle>
        <CardDescription>{t("settings.hoursHint")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <WorkingHoursEditor value={hours} onChange={setHours} disabled={saving || readOnly} />

        {readOnly ? (
          <p className="text-sm text-muted-foreground">
            {t("suspended.hours")}
          </p>
        ) : (
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {dirty ? t("settings.saveHours") : t("common.nothingToSave")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
