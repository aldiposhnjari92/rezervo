import { formatInTimeZone } from "date-fns-tz";

import { TIMEZONE } from "@/lib/availability";
import type { BookingStatus, DayKey } from "@/lib/types";
import type { Locale } from "./config";

/**
 * Formatimet që varen nga gjuha.
 *
 * Të ndara nga fjalori sepse nuk janë tekst i fiksuar por funksione mbi datat
 * dhe numrat. `formatues(locale)` kthen të gjitha njëherësh, që një komponent
 * ta marrë gjuhën një herë e të mos e kalojë si argument në çdo thirrje.
 *
 * Ora mbetet 24-orëshe në të dyja gjuhët. Formati 12-orësh amerikan nuk lexohet
 * dot shpejt në një kalendar, dhe një përdorues shqiptar që zgjedh anglishten
 * nuk pret befas "2:30 PM" te oraret e punës.
 */

const MONTHS: Record<Locale, string[]> = {
  sq: ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
       "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"],
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
};

const DAYS: Record<Locale, Record<DayKey, string>> = {
  sq: {
    monday: "E hënë", tuesday: "E martë", wednesday: "E mërkurë", thursday: "E enjte",
    friday: "E premte", saturday: "E shtunë", sunday: "E diel",
  },
  en: {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
    friday: "Friday", saturday: "Saturday", sunday: "Sunday",
  },
};

const DAYS_SHORT: Record<Locale, Record<DayKey, string>> = {
  sq: {
    monday: "Hën", tuesday: "Mar", wednesday: "Mër", thursday: "Enj",
    friday: "Pre", saturday: "Sht", sunday: "Die",
  },
  en: {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
    friday: "Fri", saturday: "Sat", sunday: "Sun",
  },
};

const STATUS: Record<Locale, Record<BookingStatus, string>> = {
  sq: { confirmed: "Konfirmuar", cancelled: "Anuluar", completed: "Përfunduar", no_show: "Nuk erdhi" },
  en: { confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed", no_show: "No-show" },
};

const FREE: Record<Locale, string> = { sq: "Falas", en: "Free" };

/** Ndarësi i mijësheve: "1.200 Lek" në shqip, "1,200 Lek" në anglisht. */
const NUMBER_LOCALE: Record<Locale, string> = { sq: "de-DE", en: "en-US" };

export type Format = ReturnType<typeof formatters>;

export function formatters(locale: Locale) {
  const months = MONTHS[locale];
  const num = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale]);

  /** "8 Gusht" / "8 August" nga një datë "yyyy-MM-dd". */
  const dayMonth = (date: string) => {
    const d = new Date(`${date}T12:00:00Z`);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  };

  return {
    locale,
    months,
    day: (key: DayKey) => DAYS[locale][key],
    dayShort: (key: DayKey) => DAYS_SHORT[locale][key],
    status: (s: BookingStatus) => STATUS[locale][s],

    /** "14:30" — 24-orësh në të dyja gjuhët, me qëllim. */
    time: (iso: string | Date) => formatInTimeZone(iso, TIMEZONE, "HH:mm"),

    dayMonth,

    /**
     * "8 Gusht 2026" — për fushat ku data zgjidhet, jo lexohet në kontekst.
     * Viti nuk hiqet: një mbyllje mund të vendoset edhe për janarin tjetër, dhe
     * "8 Janar" pa vit nuk thotë cilin.
     */
    dayMonthYear: (date: string) => {
      const d = new Date(`${date}T12:00:00Z`);
      return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    },

    /**
     * Nga një moment i saktë. Kalon nëpër datën lokale të Tiranës — një takim
     * në 00:30 i përket ditës shqiptare, jo asaj UTC.
     */
    dayMonthFromInstant: (iso: string | Date) =>
      dayMonth(formatInTimeZone(iso, TIMEZONE, "yyyy-MM-dd")),

    monthYear: (date: string) => {
      const d = new Date(`${date}T12:00:00Z`);
      return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    },

    /** ÇMIMI i një shërbimi: 0 do të thotë vërtet falas. */
    price: (value: number) => (value ? `${num(value)} Lek` : FREE[locale]),

    /** SHUMË parash: 0 do të thotë zero, jo "falas". */
    money: (value: number) => `${num(value || 0)} Lek`,

    number: num,

    duration: (minutes: number) => {
      if (minutes < 60) return `${minutes} min`;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    },
  };
}
