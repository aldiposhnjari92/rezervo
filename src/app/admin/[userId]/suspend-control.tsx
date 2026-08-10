"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useFormat, useT } from "@/lib/i18n/provider";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setBusinessSuspended } from "@/lib/admin-actions";

export function SuspendControl({
  businessId,
  businessName,
  suspendedAt,
  suspendedReason,
}: {
  businessId: string;
  businessName: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const fmt = useFormat();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const isSuspended = Boolean(suspendedAt);

  function submit(suspended: boolean) {
    startTransition(async () => {
      const result = await setBusinessSuspended({ businessId, suspended, reason });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (!suspended) {
        toast.success(
          result.emailSent
            ? `${businessName} u rikthye. Pronari u njoftua me email.`
            : `${businessName} u rikthye.`,
        );
      } else if (result.emailSent) {
        toast.success(`${businessName} u pezullua. Pronari u njoftua me email.`);
      } else {
        // Pezullimi ka ndodhur; vetëm posta dështoi. Admini duhet ta dijë
        // që pronari NUK e mori njoftimin, e jo ta besojë të kundërtën.
        toast.warning(
          `${businessName} u pezullua, por email-i nuk u dërgua${
            result.emailTo ? ` te ${result.emailTo}` : ""
          }. Njoftoje vetë.`,
        );
      }

      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
      <h2 className="font-semibold">{isSuspended ? "Biznes i pezulluar" : "Pezullo biznesin"}</h2>

      {isSuspended ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            I pezulluar më {fmt.dayMonthFromInstant(suspendedAt!)}. Faqja publike kthen 404 dhe
            nuk pranohen rezervime të reja. Të dhënat nuk janë prekur.
          </p>
          {suspendedReason && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-sm">
              <span className="text-muted-foreground">Arsyeja:</span> {suspendedReason}
            </p>
          )}

          <Button
            variant="outline"
            className="mt-4 bg-background"
            disabled={pending}
            onClick={() => submit(false)}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Rikthe biznesin
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Faqja publike do të kthejë 404 dhe rezervimet e reja bllokohen. Rezervimet ekzistuese
            dhe të dhënat nuk fshihen — veprimi kthehet mbrapsht në çdo moment.
          </p>

          <div className="mt-4 space-y-2">
            <Label htmlFor="suspend-reason">
              Arsyeja <span className="font-normal text-muted-foreground">(opsionale)</span>
            </Label>
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin.suspendReasonPlaceholder")}
              maxLength={200}
              disabled={pending}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim()
                ? t("admin.reasonSent")
                : t("admin.reasonGeneric")}
            </p>
          </div>

          <Button
            variant="destructive"
            className="mt-4"
            disabled={pending}
            onClick={() => submit(true)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Pezullo
          </Button>
        </>
      )}
    </section>
  );
}
