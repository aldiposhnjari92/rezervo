import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Kontrolli i vetëm me segmente për të gjithë aplikacionin.
 *
 * Kishim katër variante të tijat: periudhat te paneli, pamjet te kalendari,
 * skedat te rregullimet dhe renditja te klientët — secila me radius, ngjyrë dhe
 * lartësi të vetën. Zgjedhja e njëjtë duhet të duket njëlloj kudo, ndaj tani
 * dalin të gjitha nga këtu.
 *
 * Moduli nuk është "use client" me qëllim: pjesët me lidhje përdoren nga faqe
 * serveri, ato me butona nga komponentë klienti, dhe të dyja duhet të marrin
 * saktësisht të njëjtat stile.
 */
export function Segmented({
  children,
  className,
  scroll = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** E vërtetë kur segmentet nuk hyjnë në gjerësinë e telefonit. */
  scroll?: boolean;
}) {
  const track = (
    <div
      className={cn(
        "flex gap-1 rounded-xl border border-border bg-background p-1",
        scroll ? "w-max" : "w-full sm:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );

  if (!scroll) return track;
  return <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">{track}</div>;
}

/**
 * `min-w-0` nuk është zbukurim.
 *
 * Një pjesë fleksi nuk ngushtohet nën gjerësinë e tekstit të vet, ndaj tre
 * etiketa të gjata — "E ndritshme", "E errët", "Sistemi" — e shtynin shiritin
 * jashtë kartelës dhe faqja e rregullimeve rrëshqiste anash në telefonat e
 * ngushtë. Me `min-w-0` pjesët ndajnë atë që ka, dhe teksti pritet vetëm kur
 * vërtet nuk ka vend; hapësira anësore më e vogël në telefon bën që kjo të mos
 * ndodhë pothuajse kurrë.
 */
const itemClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 sm:px-3.5",
    "text-sm font-medium transition-colors",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/**
 * Nën 360px ikona ia lë vendin fjalës.
 *
 * Tri etiketa si "E ndritshme · E errët · Sistemi" bashkë me ikonat kërkojnë më
 * shumë sesa ka një telefon i vjetër, dhe atëherë secila do të pritej në "E …".
 * Ikona është zbukurim; fjala është kuptimi. Te segmentet vetëm me ikonë ajo
 * mbetet gjithnjë — pa të, butoni do të ishte bosh.
 */
const iconClass = (hasLabel: boolean) =>
  cn("h-4 w-4 shrink-0", hasLabel && "max-[359px]:hidden");

export function SegmentedLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={itemClass(active)}
    >
      {Icon && <Icon className={iconClass(true)} />}
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function SegmentedButton({
  active,
  icon: Icon,
  onClick,
  label,
  children,
}: {
  active: boolean;
  icon?: LucideIcon;
  onClick: () => void;
  /** Për segmentet vetëm me ikonë. */
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={children ? undefined : label}
      className={itemClass(active)}
    >
      {Icon && <Icon className={iconClass(Boolean(children))} />}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
}
