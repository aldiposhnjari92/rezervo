"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, Scissors, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ajo që sheh pronari derisa të vijë rezervimi i parë.
 *
 * Pa këtë, paneli i një dyqani të sapokrijuar ishte katër kuti me zero dhe tre
 * grafikë bosh — informacion zero dhe asnjë hap i qartë. Këtu ka vetëm dy gjëra
 * për të bërë, dhe e para tregon nëse është kryer.
 */
export function GettingStarted({
  hasServices,
  slug,
}: {
  hasServices: boolean;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">
        Dy hapa deri te rezervimi i parë
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sapo një klient të rezervojë, këtu do të shfaqen të ardhurat dhe statistikat.
      </p>

      <ol className="mt-7 space-y-4">
        {/* ---------------------------------------------------------- hapi 1 */}
        <li className="flex gap-4">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              hasServices
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary text-primary-foreground",
            )}
          >
            {hasServices ? <Check className="h-4 w-4" /> : "1"}
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className={cn("font-medium", hasServices && "text-muted-foreground line-through")}>
              Shto shërbimet që ofron
            </p>
            {!hasServices && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  P.sh. &quot;Prerje flokësh&quot; — 30 minuta, 500 Lek. Pa këtë, klientët
                  nuk kanë çfarë të rezervojnë.
                </p>
                <Button size="sm" className="mt-3" asChild>
                  <Link href="/services">
                    <Scissors className="h-4 w-4" />
                    Shto shërbim
                  </Link>
                </Button>
              </>
            )}
          </div>
        </li>

        {/* ---------------------------------------------------------- hapi 2 */}
        <li className="flex gap-4">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              hasServices ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            2
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className={cn("font-medium", !hasServices && "text-muted-foreground")}>
              Ndaj linkun me klientët
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Në bio të Instagram-it, në WhatsApp, ose thjesht dërgoje me mesazh.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 truncate rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm">
                rezervo.al/{slug}
              </code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyLink} disabled={!hasServices}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "U kopjua" : "Kopjo"}
                </Button>
                <Button size="sm" variant="outline" asChild disabled={!hasServices}>
                  <a href={`/${slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Hape
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-5 text-sm">
        <Link
          href="/calendar"
          className="group inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <Share2 className="h-4 w-4" />
          Ke një klient që telefonoi? Shtoje vetë
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
