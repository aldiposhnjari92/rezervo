import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { DAY_KEYS, type DayHours, type DayKey, type TakenSlot, type WorkingHours } from "./types";

/** I gjithë biznesi operon në kohën e Shqipërisë, pavarësisht ku ndodhet klienti. */
export const TIMEZONE = "Europe/Tirane";

/** Slot-et gjenerohen çdo 30 minuta. */
export const SLOT_STEP_MINUTES = 30;

/** Vlerat e parazgjedhura kur biznesi s'ka vendosur rregulla të vetat. */
export const DEFAULT_MIN_NOTICE_MINUTES = 30;
export const DEFAULT_BOOKING_WINDOW_DAYS = 7;

/** Ende e përdorur si gjatësi parazgjedhur e dritares në UI. */
export const BOOKING_WINDOW_DAYS = DEFAULT_BOOKING_WINDOW_DAYS;

/**
 * Rregullat e rezervimit të një biznesi. Të gjitha opsionale — ajo që mungon
 * merr vlerën e parazgjedhur, që kodi i vjetër të vazhdojë të funksionojë.
 */
export type BookingRules = {
  /** Minuta pushim mes dy takimeve. */
  bufferMinutes?: number;
  /** Sa përpara duhet rezervuar minimalisht. */
  minNoticeMinutes?: number;
  /** Sa ditë përpara mund të rezervohet. */
  bookingWindowDays?: number;
  /** Pushimi i përditshëm, p.sh. dreka. */
  breakStart?: string | null;
  breakEnd?: string | null;
  /** Datat "yyyy-MM-dd" ku biznesi është i mbyllur. */
  closures?: string[];
};

export type Slot = {
  /** Momenti i saktë i fillimit, ISO / UTC. Kjo është vlera që i dërgohet serverit. */
  iso: string;
  /** Ora siç e sheh klienti, p.sh. "14:30". */
  label: string;
  available: boolean;
};

export type DayAvailability = {
  /** "yyyy-MM-dd" në kohën e Tiranës. */
  date: string;
  dayKey: DayKey;
  isClosed: boolean;
  slots: Slot[];
  availableCount: number;
};

// ---------------------------------------------------------------------------
//  Ndihmës për datat
// ---------------------------------------------------------------------------

/** "HH:mm" -> minuta nga mesnata. Kthen null nëse formati është i pavlefshëm. */
function parseHhMm(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToHhMm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Dita e javës për një datë "yyyy-MM-dd".
 * Mesdita UTC bie gjithmonë brenda së njëjtës ditë kalendarike në Tiranë (UTC+1/+2),
 * ndaj është e sigurt ta përdorim si pikë referimi.
 */
export function dayKeyForDate(date: string): DayKey {
  const utcNoon = new Date(`${date}T12:00:00Z`);
  // getUTCDay(): 0 = e diel. DAY_KEYS fillon të hënën.
  return DAY_KEYS[(utcNoon.getUTCDay() + 6) % 7];
}

/** Data e sotme në Tiranë, si "yyyy-MM-dd". */
export function todayInTirane(now: Date = new Date()): string {
  return formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
}

/** Shton ditë një date "yyyy-MM-dd" pa u prekur nga zona orare. */
export function addDaysToDate(date: string, days: number): string {
  const utcNoon = new Date(`${date}T12:00:00Z`);
  utcNoon.setUTCDate(utcNoon.getUTCDate() + days);
  return utcNoon.toISOString().slice(0, 10);
}

/** Lista e `count` ditëve duke filluar nga sot (koha e Tiranës). */
export function upcomingDates(count: number, now: Date = new Date()): string[] {
  const start = todayInTirane(now);
  return Array.from({ length: count }, (_, i) => addDaysToDate(start, i));
}

/** Momenti i saktë (UTC) i orës `HH:mm` të një date, sipas kohës së Tiranës. */
export function tiraneInstant(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, TIMEZONE);
}

// ---------------------------------------------------------------------------
//  Logjika e disponueshmërisë
// ---------------------------------------------------------------------------

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Gjeneron slot-et e një dite të vetme.
 *
 * Rregullat:
 *  1. Nëse dita s'ka orar pune -> mbyllur, asnjë slot.
 *  2. Slot-et nisin çdo 30 min nga ora e hapjes.
 *  3. I gjithë shërbimi duhet të mbarojë brenda orarit të mbylljes.
 *  4. Slot-et që kanë kaluar (ose janë më afër se MIN_LEAD_MINUTES) shënohen si të zëna.
 *  5. Slot-et që mbivendosen me një rezervim ekzistues shënohen si të zëna.
 */
export function generateDaySlots(params: {
  date: string;
  hours: DayHours;
  durationMinutes: number;
  taken: TakenSlot[];
  rules?: BookingRules;
  now?: Date;
}): DayAvailability {
  const { date, hours, durationMinutes, taken, rules = {}, now = new Date() } = params;
  const dayKey = dayKeyForDate(date);

  const buffer = Math.max(0, rules.bufferMinutes ?? 0);
  const minNotice = rules.minNoticeMinutes ?? DEFAULT_MIN_NOTICE_MINUTES;

  // Një ditë e mbyllur me dorë sillet njësoj si një ditë pa orar pune.
  if (rules.closures?.includes(date)) {
    return { date, dayKey, isClosed: true, slots: [], availableCount: 0 };
  }

  const openMin = parseHhMm(hours?.start);
  const closeMin = parseHhMm(hours?.end);

  if (openMin === null || closeMin === null || closeMin <= openMin) {
    return { date, dayKey, isClosed: true, slots: [], availableCount: 0 };
  }

  const breakStart = parseHhMm(rules.breakStart);
  const breakEnd = parseHhMm(rules.breakEnd);
  const hasBreak = breakStart !== null && breakEnd !== null && breakEnd > breakStart;

  // Buffer-i zbatohet duke zgjeruar rezervimet ekzistuese në të dyja anët —
  // e njëjta logjikë si te `create_booking()` në Postgres.
  const takenRanges = taken.map((t) => ({
    start: new Date(t.start_time).getTime() - buffer * 60_000,
    end: new Date(t.end_time).getTime() + buffer * 60_000,
  }));

  const earliest = now.getTime() + minNotice * 60_000;
  const slots: Slot[] = [];

  for (let m = openMin; m + durationMinutes <= closeMin; m += SLOT_STEP_MINUTES) {
    const label = minutesToHhMm(m);
    const start = tiraneInstant(date, label).getTime();
    const end = start + durationMinutes * 60_000;

    const inPast = start < earliest;
    const isTaken = takenRanges.some((r) => overlaps(start, end, r.start, r.end));
    const hitsBreak =
      hasBreak && overlaps(m, m + durationMinutes, breakStart!, breakEnd!);

    slots.push({
      iso: new Date(start).toISOString(),
      label,
      available: !inPast && !isTaken && !hitsBreak,
    });
  }

  return {
    date,
    dayKey,
    isClosed: false,
    slots,
    availableCount: slots.filter((s) => s.available).length,
  };
}

/**
 * Disponueshmëria për `days` ditët e ardhshme.
 * Ky është funksioni që përdor faqia publike e rezervimit.
 */
export function buildAvailability(params: {
  workingHours: WorkingHours;
  durationMinutes: number;
  taken: TakenSlot[];
  rules?: BookingRules;
  days?: number;
  now?: Date;
}): DayAvailability[] {
  const {
    workingHours,
    durationMinutes,
    taken,
    rules = {},
    days = rules.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS,
    now = new Date(),
  } = params;

  return upcomingDates(days, now).map((date) =>
    generateDaySlots({
      date,
      hours: workingHours?.[dayKeyForDate(date)] ?? null,
      durationMinutes,
      taken,
      rules,
      now,
    }),
  );
}

// ---------------------------------------------------------------------------
//  Formatim për UI
// ---------------------------------------------------------------------------

export const MONTHS_SQ = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];

/** "14:30" nga një timestamp. */
export function formatTime(iso: string | Date): string {
  return formatInTimeZone(iso, TIMEZONE, "HH:mm");
}

/** "8 Gusht" nga një datë "yyyy-MM-dd". */
export function formatDayMonth(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS_SQ[d.getUTCMonth()]}`;
}

/**
 * "8 Gusht" nga një moment i saktë (timestamp).
 * Kalon nëpër datën lokale të Tiranës — një takim në 00:30 i përket ditës
 * shqiptare, jo asaj UTC.
 */
export function formatDayMonthFromInstant(iso: string | Date): string {
  return formatDayMonth(formatInTimeZone(iso, TIMEZONE, "yyyy-MM-dd"));
}

/** Numri i ditës, për tab-et e vogla në mobile. */
export function dayOfMonth(date: string): string {
  return String(new Date(`${date}T12:00:00Z`).getUTCDate());
}

/**
 * ÇMIMI i një shërbimi: 1200 -> "1.200 Lek", 0 -> "Falas".
 * Vetëm për shërbime — një shërbim me çmim zero vërtet është falas.
 */
export function formatPrice(price: number): string {
  if (!price) return "Falas";
  return `${price.toLocaleString("de-DE")} Lek`;
}

/**
 * SHUMË parash: 1200 -> "1.200 Lek", 0 -> "0 Lek".
 *
 * E ndarë nga `formatPrice` sepse zero do të thotë gjëra krejt të ndryshme:
 * një shërbim me çmim zero është "Falas", por të ardhura zero janë "0 Lek".
 * Të ardhurat e shfaqura si "Falas" ishin thjesht gabim.
 */
export function formatMoney(amount: number): string {
  return `${(amount || 0).toLocaleString("de-DE")} Lek`;
}

/** "45 min" ose "1h 30min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
