import { formatInTimeZone } from "date-fns-tz";

import { addDaysToDate, MONTHS_SQ, TIMEZONE } from "./availability";
import { DAY_KEYS, type BookingWithService, type DayKey, type WorkingHours } from "./types";

export type CalendarView = "day" | "week" | "month";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "day"];

export const VIEW_LABELS_SQ: Record<CalendarView, string> = {
  month: "Muaj",
  week: "Javë",
  day: "Ditë",
};

export function isCalendarView(value: unknown): value is CalendarView {
  return value === "day" || value === "week" || value === "month";
}

// ---------------------------------------------------------------------------
//  Data si tekst "yyyy-MM-dd" — pa Date objekte, pa befasi nga zona orare
// ---------------------------------------------------------------------------

function utcNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** E hëna e javës që përmban `date`. */
export function startOfWeek(date: string): string {
  const dow = (utcNoon(date).getUTCDay() + 6) % 7; // 0 = e hënë
  return addDaysToDate(date, -dow);
}

/** Dita e parë e muajit që përmban `date`. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Dita e fundit e muajit që përmban `date`. */
export function endOfMonth(date: string): string {
  const d = utcNoon(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: string, delta: number): string {
  const d = utcNoon(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

/** 7 ditët e javës që përmban `date`, duke nisur të hënën. */
export function weekDates(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDaysToDate(monday, i));
}

/**
 * Rrjeti i muajit: javë të plota (e hënë → e diel) që mbulojnë gjithë muajin.
 * Kthen 35 ose 42 ditë, sipas nevojës — jo gjithmonë 6 rreshta, që të mos
 * mbetet një rresht bosh poshtë.
 */
export function monthGrid(date: string): string[] {
  const first = startOfWeek(startOfMonth(date));
  const last = endOfMonth(date);
  const dates: string[] = [];

  let cursor = first;
  while (cursor <= last || dates.length % 7 !== 0) {
    dates.push(cursor);
    cursor = addDaysToDate(cursor, 1);
    if (dates.length > 42) break;
  }
  return dates;
}

export function isSameMonth(date: string, reference: string): boolean {
  return date.slice(0, 7) === reference.slice(0, 7);
}

/** Intervali që duhet marrë nga baza për një pamje të caktuar. */
export function rangeForView(view: CalendarView, date: string): { from: string; to: string } {
  if (view === "day") return { from: date, to: addDaysToDate(date, 1) };
  if (view === "week") {
    const monday = startOfWeek(date);
    return { from: monday, to: addDaysToDate(monday, 7) };
  }
  const grid = monthGrid(date);
  return { from: grid[0], to: addDaysToDate(grid[grid.length - 1], 1) };
}

/** Hapi i shigjetave ‹ › sipas pamjes. */
export function stepDate(view: CalendarView, date: string, delta: number): string {
  if (view === "day") return addDaysToDate(date, delta);
  if (view === "week") return addDaysToDate(date, delta * 7);
  return addMonths(date, delta);
}

// ---------------------------------------------------------------------------
//  Etiketa
// ---------------------------------------------------------------------------

export function formatMonthYear(date: string): string {
  const d = utcNoon(date);
  return `${MONTHS_SQ[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Titulli mbi kalendar, sipas pamjes. */
export function headingForView(view: CalendarView, date: string): string {
  if (view === "month") return formatMonthYear(date);

  if (view === "week") {
    const days = weekDates(date);
    const first = utcNoon(days[0]);
    const last = utcNoon(days[6]);
    const sameMonth = days[0].slice(0, 7) === days[6].slice(0, 7);

    return sameMonth
      ? `${first.getUTCDate()} – ${last.getUTCDate()} ${MONTHS_SQ[last.getUTCMonth()]} ${last.getUTCFullYear()}`
      : `${first.getUTCDate()} ${MONTHS_SQ[first.getUTCMonth()]} – ${last.getUTCDate()} ${MONTHS_SQ[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  }

  const d = utcNoon(date);
  return `${d.getUTCDate()} ${MONTHS_SQ[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
//  Rezervimet -> pozicion në rrjetë
// ---------------------------------------------------------------------------

/** Data lokale (Tiranë) e një rezervimi, si "yyyy-MM-dd". */
export function bookingDate(booking: { start_time: string }): string {
  return formatInTimeZone(booking.start_time, TIMEZONE, "yyyy-MM-dd");
}

/** Minutat nga mesnata (kohë Tirane) për një timestamp. */
export function minutesFromMidnight(iso: string): number {
  const [h, m] = formatInTimeZone(iso, TIMEZONE, "HH:mm").split(":");
  return Number(h) * 60 + Number(m);
}

export function groupByDate<T extends { start_time: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = bookingDate(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function parseHhMm(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Sa orë duhen shfaqur vertikalisht: orari i punës, i zgjeruar sa duhet
 * për të përfshirë çdo rezervim (edhe ato jashtë orarit, p.sh. pas ndryshimit
 * të orarit). Rrumbullakoset në orë të plota.
 */
const DAY_MIN = 24 * 60;

/** Sa orë duhen parë të paktën, që rrjeta e shtrirë të mos dalë e zbrazët. */
const MIN_WINDOW_MIN = 8 * 60;

export function visibleHourRange(
  workingHours: WorkingHours | null,
  bookings: BookingWithService[],
  dates?: string[],
): { startMin: number; endMin: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  const keys: DayKey[] = dates?.length
    ? dates.map((d) => DAY_KEYS[(utcNoon(d).getUTCDay() + 6) % 7])
    : [...DAY_KEYS];

  for (const key of keys) {
    const hours = workingHours?.[key];
    const open = parseHhMm(hours?.start);
    const close = parseHhMm(hours?.end);
    if (open === null || close === null) continue;
    start = Math.min(start, open);
    end = Math.max(end, close);
  }

  for (const booking of bookings) {
    start = Math.min(start, minutesFromMidnight(booking.start_time));
    end = Math.max(end, minutesFromMidnight(booking.end_time));
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { startMin: 8 * 60, endMin: 20 * 60 };
  }

  let startMin = Math.max(0, Math.floor(start / 60) * 60);
  let endMin = Math.min(DAY_MIN, Math.ceil(end / 60) * 60);

  // Një ditë e mbyllur me dy rezervime jepte një dritare prej dy orësh. Rrjeta
  // tani shtrihet sa gjithë lartësia e faqes, ndaj ajo dritare do të bëhej dy
  // orë të gjata sa gjysmë ekrani. Nën minimumin, dritarja zgjerohet në të dyja
  // anët: mban brendinë në qendër dhe jep kontekstin e orëve përreth.
  if (endMin - startMin < MIN_WINDOW_MIN) {
    const missing = MIN_WINDOW_MIN - (endMin - startMin);
    startMin = Math.max(0, startMin - Math.floor(missing / 120) * 60);
    endMin = Math.min(DAY_MIN, startMin + MIN_WINDOW_MIN);
    startMin = Math.max(0, endMin - MIN_WINDOW_MIN);
  }

  return { startMin, endMin };
}

export type PositionedBooking = {
  booking: BookingWithService;
  startMin: number;
  endMin: number;
  /** Kolona brenda një grupi që mbivendoset. */
  lane: number;
  /** Sa kolona ka ai grup gjithsej. */
  lanes: number;
};

/**
 * Rregullon rezervimet e një dite në kolona.
 *
 * Constraint-i `bookings_no_overlap` ndalon mbivendosjet mes rezervimeve
 * aktive, por ato të anuluara mund të mbivendosen me një aktiv — prandaj
 * duhet ende një ndarje në kolona.
 */
export function layoutDay(bookings: BookingWithService[]): PositionedBooking[] {
  const items = bookings
    .map((booking) => ({
      booking,
      startMin: minutesFromMidnight(booking.start_time),
      endMin: minutesFromMidnight(booking.end_time),
    }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: PositionedBooking[] = [];
  let cluster: (typeof items)[number][] = [];
  let clusterEnd = -1;

  function flush() {
    if (cluster.length === 0) return;

    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[lane] = item.endMin;
      }
      return { ...item, lane };
    });

    for (const item of assigned) {
      result.push({ ...item, lanes: laneEnds.length });
    }
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of items) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return result;
}
