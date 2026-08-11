"use client";

import Link from "next/link";
import { FileText, Info } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useFormat, useT } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/sq";
import type { Invoice } from "@/lib/types";

export function InvoicesList({
  invoices,
  missingNipt,
  missingAddress,
}: {
  invoices: Invoice[];
  missingNipt: boolean;
  missingAddress: boolean;
}) {
  const t = useT();
  const fmt = useFormat();

  /**
   * Kërkohet vetëm ajo që mungon vërtet.
   *
   * Më parë kushti ishte "të dyja bashkë", ndaj kujt kishte shkruar NIPT-in pa
   * adresë i thuhej të shtonte NIPT-in — një gjë që e kishte bërë tashmë.
   */
  const missing: DictKey | null =
    missingNipt && missingAddress
      ? "invoices.missingBoth"
      : missingNipt
        ? "invoices.missingNipt"
        : missingAddress
          ? "invoices.missingAddress"
          : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.subtitle", { count: invoices.length })}
      />

      {/*
        Faturat pa NIPT dalin bosh te koka. Më mirë të thuhet këtu se sa ta
        zbulojë pronari pasi ia ka dhënë faturën klientit.
      */}
      {missing && invoices.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {t(missing)}
        </p>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("invoices.emptyTitle")}
          description={t("invoices.emptyBody")}
        />
      ) : (
        <>
          {/* Tabelë në ekran të gjerë, kartela në telefon — si te klientët. */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("invoices.colNumber")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("invoices.colDate")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("invoices.colBuyer")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("invoices.colTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium tabular-nums text-primary hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmt.dayMonthYear(invoice.issued_on)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="truncate">{invoice.buyer_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {fmt.money(invoice.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 lg:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">{invoice.number}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {invoice.buyer_name} · {fmt.dayMonthYear(invoice.issued_on)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {fmt.money(invoice.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
