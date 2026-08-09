import { formatTime, formatDayMonth, TIMEZONE } from "./availability";
import { formatInTimeZone } from "date-fns-tz";

/**
 * MOCK — V1 nuk dërgon asgjë vërtet.
 *
 * Kur të vijë koha për integrim real (WhatsApp Business API / Twilio),
 * i vetmi vend që ndryshon është trupi i këtij funksioni: të gjithë
 * thirrësit tashmë i japin numrin e normalizuar dhe orën në UTC.
 */
export async function sendWhatsAppReminder(
  phone: string,
  time: string | Date,
  options?: { businessName?: string; customerName?: string },
): Promise<{ sent: boolean; provider: string }> {
  const when = `${formatDayMonth(formatInTimeZone(time, TIMEZONE, "yyyy-MM-dd"))} në orën ${formatTime(time)}`;
  const who = options?.customerName ? `${options.customerName}, ` : "";
  const where = options?.businessName ? ` te ${options.businessName}` : "";

  const message =
    `${who}ju kujtojmë rezervimin tuaj${where}: ${when}. ` +
    `Nëse nuk mund të vini, ju lutem na njoftoni.`;

  console.log("[sendWhatsAppReminder] ->", phone, "|", message);

  return { sent: false, provider: "mock" };
}

/** Njoftim për pronarin kur mbërrin një rezervim i ri. MOCK. */
export async function notifyOwnerNewBooking(
  ownerPhone: string | null,
  details: { customerName: string; serviceName: string; time: string | Date },
): Promise<void> {
  if (!ownerPhone) return;
  console.log(
    "[notifyOwnerNewBooking] ->",
    ownerPhone,
    `| Rezervim i ri: ${details.customerName} — ${details.serviceName} në ${formatTime(details.time)}`,
  );
}
