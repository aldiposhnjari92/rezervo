"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { waLink } from "@/lib/whatsapp-messages";
import { cn } from "@/lib/utils";

/**
 * Hap WhatsApp-in me mesazhin e shkruar tashmë.
 *
 * Kjo është rruga falas: nuk kalon nga asnjë API, nuk kërkon miratim nga Meta
 * dhe nuk faturohet — mesazhi niset nga numri i vetë pronarit, me një prekje.
 * Ndaj kopsa rri kudo ku pronari mund të dojë t'i shkruajë një klienti, edhe
 * kur dërgimi automatik nuk është i konfiguruar fare.
 *
 * `noreferrer` nuk është kozmetikë: pa të, faqja e hapur mban një referencë te
 * kjo dritare.
 */
export function WhatsAppButton({
  phone,
  message,
  label,
  variant = "outline",
  size,
  className,
}: {
  phone: string | null;
  message: string;
  label: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "icon";
  className?: string;
}) {
  const link = phone ? waLink(phone, message) : null;

  // Pa numër s'ka ku të shkruhet; kopsa rri e dukshme por e fikur, që rreshti të
  // mos kërcejë sa herë një klient ka numër e një tjetër jo.
  if (!link) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && label}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} asChild className={cn(className)}>
      <a href={link} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && label}
      </a>
    </Button>
  );
}
