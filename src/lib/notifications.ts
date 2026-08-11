import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { formatTime, formatDayMonth, TIMEZONE } from "./availability";
import { sendWhatsApp, type WhatsAppResult } from "./whatsapp";
import { confirmationText, ownerAlertText, reminderText } from "./whatsapp-messages";

/**
 * Njoftimet me WhatsApp.
 *
 * Deri më 2026-08-11 këto ishin `console.log` — dhe faqja i premtonte klientit
 * një kujtesë që nuk vinte kurrë. Tani dërgojnë vërtet, POR vetëm kur ekzistojnë
 * `WHATSAPP_TOKEN` dhe `WHATSAPP_PHONE_ID`. Pa to, `sendWhatsApp` kthen
 * `sent:false` dhe pronari e nis vetë mesazhin nga një link `wa.me` — falas.
 *
 * Asnjë prej tyre nuk hedh përjashtim: një rezervim i kryer nuk prishet sepse
 * njoftimi dështoi.
 *
 * Teksti mbetet shqip me qëllim, si te email-et e pezullimit: gjuha e klientit
 * nuk njihet në momentin e dërgimit, dhe klientët e këtyre bizneseve janë shqiptarë.
 */

type BookingNotice = {
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  businessName: string;
  businessPhone?: string | null;
  /** Momenti i saktë i takimit. */
  time: string | Date;
};

function facts(notice: BookingNotice) {
  return {
    businessName: notice.businessName,
    serviceName: notice.serviceName,
    customerName: notice.customerName,
    date: formatDayMonth(formatInTimeZone(notice.time, TIMEZONE, "yyyy-MM-dd")),
    time: formatTime(notice.time),
    businessPhone: notice.businessPhone ?? null,
  };
}

/** Konfirmimi që i shkon klientit sapo rezervon. */
export async function sendBookingConfirmation(notice: BookingNotice): Promise<WhatsAppResult> {
  if (!notice.customerPhone) {
    return { sent: false, route: "link", reason: "klienti pa numër" };
  }

  const f = facts(notice);
  return sendWhatsApp({
    to: notice.customerPhone,
    text: confirmationText(f),
    kind: "confirmation",
    params: [f.customerName, f.businessName, f.serviceName, f.date, f.time],
  });
}

/** Kujtesa para takimit — e nis puna e planifikuar te `/api/cron/reminders`. */
export async function sendBookingReminder(notice: BookingNotice): Promise<WhatsAppResult> {
  if (!notice.customerPhone) {
    return { sent: false, route: "link", reason: "klienti pa numër" };
  }

  const f = facts(notice);
  return sendWhatsApp({
    to: notice.customerPhone,
    text: reminderText(f),
    kind: "reminder",
    params: [f.customerName, f.businessName, f.serviceName, f.date, f.time],
  });
}

/** Njoftimi te numri i pronarit kur mbërrin një rezervim i ri. */
export async function notifyOwnerNewBooking(
  ownerPhone: string | null,
  notice: BookingNotice,
): Promise<WhatsAppResult> {
  if (!ownerPhone) return { sent: false, route: "link", reason: "pronari pa numër" };

  const f = facts(notice);
  return sendWhatsApp({
    to: ownerPhone,
    text: ownerAlertText({ ...f, customerPhone: notice.customerPhone }),
    kind: "ownerAlert",
    params: [f.customerName, f.serviceName, f.date, f.time],
  });
}
