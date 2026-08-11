import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getFormat, getT } from "@/lib/i18n";
import type { AdminSubscriptionRow } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

/**
 * Kush paguan, dhe kush jo.
 *
 * Nuk ka kolonë "i abonuar" te bizneset: fatura e muajit ËSHTË regjistri. Ndaj
 * lista renditet me të abonuarit e këtij muaji lart — pyetja e vërtetë nuk është
 * "sa biznese kemi", por "sa prej tyre e kanë paguar këtë muaj".
 */
export function Subscriptions({ rows }: { rows: AdminSubscriptionRow[] }) {
  const t = getT();
  const fmt = getFormat();

  const billed = rows.filter((r) => r.billed_this_month);
  const monthlyTotal = rows.reduce((sum, r) => sum + r.this_month_total, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-semibold">{t("admin.subscriptions")}</h2>
        <span className="text-sm text-muted-foreground">
          {t("admin.subscribedOf", { count: billed.length, total: rows.length })} ·{" "}
          {fmt.money(monthlyTotal)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          {t("admin.noBusinesses")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">{t("admin.colBusiness")}</th>
                <th className="px-5 py-2.5 font-medium">{t("admin.thisMonth")}</th>
                <th className="px-5 py-2.5 text-right font-medium">{t("admin.invoicesCount")}</th>
                <th className="px-5 py-2.5 text-right font-medium">{t("admin.billedTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.business_id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/${row.owner_id}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{row.owner_email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium",
                        row.billed_this_month ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {row.billed_this_month ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Minus className="h-3.5 w-3.5" />
                      )}
                      {row.billed_this_month ? t("admin.paidThisMonth") : t("admin.notBilled")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {row.invoices_count}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">
                    {fmt.money(row.total_billed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
