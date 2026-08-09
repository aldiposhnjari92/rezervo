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

    toast.success("Orari u ruajt.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Orari i punës</CardTitle>
        <CardDescription>
          Klientët mund të rezervojnë vetëm brenda këtyre orareve. Ndryshimet prekin
          rezervimet e reja, jo ato ekzistuese.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <WorkingHoursEditor value={hours} onChange={setHours} disabled={saving} />

        <Button onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {dirty ? "Ruaj orarin" : "Asgjë për të ruajtur"}
        </Button>
      </CardContent>
    </Card>
  );
}
