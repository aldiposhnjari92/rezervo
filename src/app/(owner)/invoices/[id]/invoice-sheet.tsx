"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFormat, useT } from "@/lib/i18n/provider";
import type { Invoice } from "@/lib/types";

/**
 * Fatura, e bërë për letër.
 *
 * Printimi kalon nëpër shfletuesin (Ctrl+P -> "Ruaj si PDF"): asnjë bibliotekë
 * PDF-je nuk hyn te paketa, dhe fleta del me të njëjtin font e të njëjtat
 * rregulla si pjesa tjetër e aplikacionit. `print:` i Tailwind-it e heq
 * shtyllën anësore, butonat dhe ngjyrat e sfondit kur del te letra.
 */
export function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  const t = useT();
  const fmt = useFormat();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            {t("invoices.back")}
          </Link>
        </Button>

        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t("invoices.print")}
        </Button>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 sm:p-9 print:rounded-none print:border-0 print:p-0">
        {/* ------------------------------------------------------------ koka */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoices.seller")}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{invoice.seller_name}</p>
            {invoice.seller_nipt && (
              <p className="text-sm text-muted-foreground">
                {t("invoices.nipt")}: <span className="tabular-nums">{invoice.seller_nipt}</span>
              </p>
            )}
            {invoice.seller_address && (
              <p className="text-sm text-muted-foreground">{invoice.seller_address}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("invoices.number")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{invoice.number}</p>
            <p className="text-sm text-muted-foreground">
              {t("invoices.issuedOn")} {fmt.dayMonthYear(invoice.issued_on)}
            </p>
            {invoice.period_start && invoice.period_end && (
              <p className="text-sm text-muted-foreground">
                {t("invoices.period")}: {fmt.dayMonthYear(invoice.period_start)} –{" "}
                {fmt.dayMonthYear(invoice.period_end)}
              </p>
            )}
          </div>
        </header>

        {/* --------------------------------------------------------- blerësi */}
        <section className="py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("invoices.buyer")}
          </p>
          <p className="mt-1 font-medium">{invoice.buyer_name}</p>
          {invoice.buyer_nipt && (
            <p className="text-sm text-muted-foreground">
              {t("invoices.nipt")}: <span className="tabular-nums">{invoice.buyer_nipt}</span>
            </p>
          )}
          {invoice.buyer_address && (
            <p className="text-sm text-muted-foreground">{invoice.buyer_address}</p>
          )}
        </section>

        {/* --------------------------------------------------------- rreshtat */}
        <table className="w-full text-sm">
          <thead className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2.5 font-medium">{t("invoices.description")}</th>
              <th className="py-2.5 text-right font-medium">{t("invoices.qty")}</th>
              <th className="py-2.5 text-right font-medium">{t("invoices.unitPrice")}</th>
              <th className="py-2.5 text-right font-medium">{t("invoices.lineTotal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lines.map((line, i) => (
              <tr key={i}>
                <td className="py-3 pr-3">{line.description}</td>
                <td className="py-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-3 text-right tabular-nums">{fmt.money(line.unit_price)}</td>
                <td className="py-3 text-right font-medium tabular-nums">
                  {fmt.money(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* --------------------------------------------------------- totalet */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <Total label={t("invoices.subtotal")} value={fmt.money(invoice.subtotal)} />
            {invoice.vat_rate > 0 && (
              <Total
                label={t("invoices.vat", { rate: invoice.vat_rate })}
                value={fmt.money(invoice.vat_amount)}
              />
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>{t("invoices.total")}</dt>
              <dd className="tabular-nums">{fmt.money(invoice.total)}</dd>
            </div>
          </dl>
        </div>

        {invoice.note && <p className="mt-6 text-sm text-muted-foreground">{invoice.note}</p>}

        <footer className="mt-8 space-y-1 border-t border-border pt-5 text-xs text-muted-foreground">
          {invoice.kind === "booking" && <p>{t("invoices.payInShop")}</p>}
          {/*
            E thënë hapur, edhe te letra: pa këtë rresht dokumenti duket si
            faturë tatimore, dhe nuk është.
          */}
          <p>{t("invoices.notFiscal")}</p>
        </footer>
      </article>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
