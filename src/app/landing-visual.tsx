import { Bell, Check, TrendingUp } from "lucide-react";

import { getT } from "@/lib/i18n";

/**
 * Pamjet e produktit për faqen e prezantimit.
 *
 * Statike me qëllim — një faqe prezantimi nuk duhet të prekë bazën e të dhënave —
 * por të ndërtuara me të njëjtat rregulla si produkti: bosht orësh, blloqe sipas
 * minutave, dhe ngjyrat e statuseve nga paleta e validuar.
 */

const START_HOUR = 9;
const END_HOUR = 18;
const HOUR_PX = 46;

const BOOKINGS = [
  { at: "09:30", mins: 30, name: "Ana Hoxha", service: "Prerje flokësh", tone: "done" },
  { at: "10:30", mins: 60, name: "Beni Shala", service: "Prerje + Mjekër", tone: "open" },
  { at: "12:00", mins: 30, name: "Dorian Leka", service: "Rregullim mjekre", tone: "done" },
  { at: "14:30", mins: 45, name: "Mira Zeqo", service: "Larje + Stilim", tone: "open" },
  { at: "16:00", mins: 60, name: "Klea Gjoka", service: "Prerje + Mjekër", tone: "open" },
] as const;

const TONES = {
  done: { bar: "#047857", wash: "rgba(4,120,87,0.10)" },
  open: { bar: "#2563eb", wash: "rgba(37,99,235,0.10)" },
  miss: { bar: "#b45309", wash: "rgba(180,83,9,0.10)" },
} as const;

function minutesFromStart(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h - START_HOUR) * 60 + m;
}

/** Kornizë shfletuesi — i jep pamjes kontekst dhe thellësi. */
export function BrowserFrame({
  url,
  children,
  className = "",
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/[0.03] dark:ring-white/[0.06] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="mx-auto flex max-w-[16rem] flex-1 items-center justify-center rounded-md bg-background/80 px-3 py-1">
          <span className="truncate text-[11px] text-muted-foreground">{url}</span>
        </div>
        <div className="w-11" />
      </div>
      {children}
    </div>
  );
}

/** Pamja ditore e kalendarit. */
export function CalendarSpread() {
  const t = getT();
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;
  const breakTop = (minutesFromStart("13:00") / 60) * HOUR_PX;

  return (
    <div className="bg-card">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">{t("mock.day")}</p>
          <p className="text-xs text-muted-foreground">{t("mock.daySummary")}</p>
        </div>
        <div className="hidden items-center rounded-lg bg-muted p-0.5 text-xs font-medium sm:flex">
          <span className="rounded-md px-2.5 py-1 text-muted-foreground">{t("calendar.month")}</span>
          <span className="rounded-md px-2.5 py-1 text-muted-foreground">{t("calendar.week")}</span>
          <span className="rounded-md bg-background px-2.5 py-1 shadow-sm">{t("calendar.day")}</span>
        </div>
      </div>

      <div className="flex px-5 py-5">
        <div className="w-10 shrink-0" style={{ height: gridHeight }}>
          {hours.slice(0, -1).map((h) => (
            <div key={h} style={{ height: HOUR_PX }} className="relative">
              <span className="absolute -top-1.5 right-3 text-[10px] tabular-nums text-muted-foreground">
                {String(h).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: gridHeight }}>
          <div className="pointer-events-none absolute inset-0">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/70"
                style={{ top: i * HOUR_PX }}
              />
            ))}
          </div>

          <div
            className="absolute inset-x-0 flex items-center justify-center rounded-lg bg-muted/70"
            style={{ top: breakTop, height: HOUR_PX - 4 }}
          >
            <span className="text-[11px] font-medium text-muted-foreground">Pushim dreke</span>
          </div>

          {BOOKINGS.map((b) => {
            const top = (minutesFromStart(b.at) / 60) * HOUR_PX;
            const height = (b.mins / 60) * HOUR_PX;
            const tone = TONES[b.tone];
            const tight = height < 36;

            return (
              <div
                key={b.at}
                className="absolute left-0 right-2 overflow-hidden rounded-lg pl-3 pr-2"
                style={{
                  top,
                  height: height - 4,
                  background: tone.wash,
                  borderLeft: `3px solid ${tone.bar}`,
                }}
              >
                <p
                  className={`truncate font-medium tracking-tight ${tight ? "text-[11px] leading-[1.9]" : "pt-1 text-[12px] leading-tight"}`}
                >
                  <span className="tabular-nums text-muted-foreground">{b.at}</span>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  {b.name}
                </p>
                {!tight && (
                  <p className="truncate pt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {b.service}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Kartelë e vogël që noton mbi pamjen kryesore. */
export function FloatingNotification({ className = "" }: { className?: string }) {
  const t = getT();
  return (
    <div
      className={`w-[15rem] rounded-2xl border border-border bg-card p-4 shadow-xl shadow-primary/10 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{t("mock.newBooking")}</p>
          <p className="truncate text-xs text-muted-foreground">Ana Hoxha · 09:30</p>
        </div>
      </div>
    </div>
  );
}

export function FloatingEarnings({ className = "" }: { className?: string }) {
  const t = getT();
  return (
    <div
      className={`w-[13rem] rounded-2xl border border-border bg-card p-4 shadow-xl shadow-emerald-500/10 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </span>
        <p className="text-xs text-muted-foreground">{t("mock.thisWeek")}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">18.400 L</p>
      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        +24% nga java e kaluar
      </p>
    </div>
  );
}

/** Paneli i të ardhurave — për seksionin e analitikës. */
export function EarningsPanel() {
  const t = getT();
  const bars = [40, 62, 48, 78, 55, 92, 70];
  const days = ["H", "M", "M", "E", "P", "S", "D"];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("mock.revenue30")}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">64.800 L</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          +18%
        </span>
      </div>

      <div className="mt-7 flex h-28 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md bg-primary transition-all"
              style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.35 }}
            />
            <span className="text-[10px] text-muted-foreground">{days[i]}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
        {[
          ["Rezervime", "128"],
          [t("mock.customers"), "94"],
          [t("mock.noShows"), "6"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Telefon me faqen publike të rezervimit. */
export function PhoneBooking() {
  const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];

  return (
    <div className="mx-auto w-[17rem] rounded-[2rem] border-[6px] border-foreground/90 bg-card p-4 shadow-2xl shadow-primary/20">
      <div className="mx-auto mb-4 h-1 w-14 rounded-full bg-foreground/20" />

      <p className="text-lg font-bold tracking-tight">Berberi Ilir</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Zgjidh shërbimin dhe orën</p>

      <div className="mt-4 rounded-xl border-2 border-primary bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Prerje flokësh</p>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">30 min · 500 Lek</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {slots.map((s, i) => (
          <span
            key={s}
            className={`rounded-lg py-2 text-center text-xs font-medium ${
              i === 2
                ? "bg-primary text-primary-foreground"
                : i === 1
                  ? "bg-muted text-muted-foreground/50 line-through"
                  : "border border-border"
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        Konfirmo Rezervimin
      </div>
    </div>
  );
}
