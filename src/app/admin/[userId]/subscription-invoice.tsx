"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { issueSubscriptionInvoice } from "@/lib/admin-actions";
import { useT } from "@/lib/i18n/provider";
import { todayInTirane } from "@/lib/availability";

/**
 * Fatura e abonimit për muajin që po ecën.
 *
 * Vetëm admini e lëshon, dhe vetëm një herë për muaj: funksioni në Postgres
 * kthen atë ekzistuese nëse muaji është faturuar tashmë. Pronari e sheh pastaj
 * te faqja e tij e faturave.
 */
export function SubscriptionInvoice({ businessId }: { businessId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();

  function issue() {
    startTransition(async () => {
      const result = await issueSubscriptionInvoice({
        businessId,
        periodStart: todayInTirane(),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("invoices.subscriptionIssued"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("invoices.kindSubscription")}</CardTitle>
        <CardDescription>{t("invoices.notFiscal")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={issue} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {t("invoices.subscriptionIssue")}
        </Button>
      </CardContent>
    </Card>
  );
}
