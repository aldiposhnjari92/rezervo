"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Matja duhet bërë para pikturimit; në server nuk ka çfarë të matet. */
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

type TriggerState = { open: boolean; toggle: () => void };

/**
 * Paneli që varet nga një buton — themeli i zgjedhësve tanë.
 *
 * Kontrollet vendase (`<select>`, `input[type=date]`) i vizaton sistemi operativ,
 * jo tema e aplikacionit: mbi një ndërfaqe të errët hapej listë e bardhë sistemi,
 * me font e radius që nuk i përkisnin asnjë pjese tjetër. Menyja e llogarisë dhe
 * kambana e njoftimeve ishin ndërtuar prej kohësh si panele tanët; kjo pjesë e
 * bën atë pamje të arritshme kudo.
 *
 * Këtu rri vetëm ajo që e ka çdo panel: hapja, klikimi jashtë, Escape dhe vendi
 * ku shfaqet. Se çfarë ka brenda — listë apo kalendar — vendoset nga jashtë,
 * sepse tastiera e një liste nuk është e njëjta me tastierën e një rrjete.
 */
export function Popover({
  className,
  panelClassName,
  trigger,
  children,
}: {
  className?: string;
  panelClassName?: string;
  trigger: (state: TriggerState) => React.ReactNode;
  children: (state: { close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function close(refocus = false) {
    setOpen(false);
    if (refocus) ref.current?.querySelector("button")?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    /**
     * Rrjetë sigurie: kur brenda panelit s'ka gjë që merr fokus, ngjarja nuk
     * kalon dot nga vetë paneli.
     */
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Poshtë butonit, veç kur poshtë nuk ka vend.
   *
   * Kontrolli vendas e zgjidhte vetë këtë: lista e tij dilte mbi faqen dhe
   * kthehej përmbys kur ishte afër fundit. Paneli ynë është element i zakonshëm,
   * ndaj e matim vetë — përndryshe ora e së dielës, rreshti i fundit i orarit,
   * do të hapej jashtë ekranit.
   */
  useMeasure(() => {
    if (!open) {
      setAbove(false);
      return;
    }
    const trigger = ref.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!trigger || !panel) return;

    const below = window.innerHeight - trigger.bottom;
    setAbove(below < panel.height + 8 && trigger.top > below);
  }, [open]);

  function onPanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    // Brenda një dialogu, Escape do të mbyllte edhe dialogun bashkë me panelin.
    event.stopPropagation();
    event.preventDefault();
    close(true);
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && (
        <div
          ref={panelRef}
          onKeyDown={onPanelKeyDown}
          className={cn(
            "absolute z-50 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg",
            above ? "bottom-full mb-1" : "top-full mt-1",
            panelClassName,
          )}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}

/** Vetëm zërat e përzgjedhshëm — të çaktivizuarit nuk marrin fokus. */
function itemsOf(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not(:disabled)') ?? []);
}

export function focusCell(item: HTMLElement | undefined | null) {
  if (!item) return;
  // Fokusi vetë do ta rrëshqiste panelin; e bëjmë me dorë që rrëshqitja të
  // ndalet te kutia e panelit e të mos lëvizë faqja poshtë tij.
  item.focus({ preventScroll: true });
  item.scrollIntoView({ block: "nearest" });
}

/**
 * Meny zgjedhjeje: një listë ku zgjidhet një zë.
 *
 * Tastiera është e njëjta që jepte `<select>`-i, ndryshe zëvendësimi do të ishte
 * prapakthim: shigjetat lëvizin, Home/End kapërcejnë, Escape mbyll.
 */
export function Dropdown({
  className,
  panelClassName,
  trigger,
  children,
}: {
  className?: string;
  panelClassName?: string;
  trigger: (state: TriggerState) => React.ReactNode;
  children: (state: { close: () => void }) => React.ReactNode;
}) {
  return (
    <Popover className={className} panelClassName={panelClassName} trigger={trigger}>
      {({ close }) => <Menu>{children({ close })}</Menu>}
    </Popover>
  );
}

/** Vizatohet vetëm kur menyja është e hapur, ndaj "montim" do të thotë "u hap". */
function Menu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Fokusi shkon te zgjedhja aktuale — te një listë me 96 orë, hapja duhet të
  // tregojë orën e tanishme, jo mesnatën.
  useEffect(() => {
    const items = itemsOf(ref.current);
    focusCell(items.find((el) => el.dataset.selected === "true") ?? items[0]);
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = itemsOf(ref.current);
    if (!items.length) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : event.key === "ArrowUp"
          ? (current - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;

    if (next < 0) return;
    event.preventDefault();
    focusCell(items[next]);
  }

  return (
    <div ref={ref} role="menu" onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export function DropdownItem({
  selected,
  disabled,
  onSelect,
  className,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      data-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
      {selected && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}
