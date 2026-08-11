/**
 * Tekstet e WhatsApp-it dhe zgjedhja e rrugës — logjikë e pastër, pa rrjet.
 *
 * E ndarë nga `whatsapp.ts` (që është `server-only`) pikërisht si te email-i:
 * kështu mesazhet dhe linqet mbulohen me teste. Një gabim këtu do të thoshte
 * mesazhe të gabuara te klientët e vërtetë, ose linqe që nuk hapen fare.
 */

export type WhatsAppRoute = "cloud" | "link";

/** Variablat që ndezin dërgimin automatik. Të dyja duhen. */
export const CLOUD_ENV = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"] as const;

/**
 * A dërgon vetë sistemi, apo bëhet me dorë?
 *
 * Pa çelësa, rruga është `link`: aplikacioni ndërton një `wa.me` që e hap
 * pronari. Kjo nuk kushton asgjë dhe punon që sot — por asgjë nuk niset vetë.
 * Me çelësa, mesazhet e nisura nga sistemi shkojnë përmes Cloud API-t të Meta-s,
 * që faturohet për çdo bisedë.
 */
export function whatsappRoute(env: NodeJS.ProcessEnv = process.env): WhatsAppRoute {
  return CLOUD_ENV.every((key) => env[key]?.trim()) ? "cloud" : "link";
}

/**
 * Numri siç e do WhatsApp-i: vetëm shifra, me prefiks shteti, pa `+`.
 * "+355691234567" -> "355691234567"
 */
export function waNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Linku "click to chat".
 *
 * `wa.me` e hap bisedën me tekstin e shkruar tashmë; dërgimin e bën njeriu me
 * një prekje. Asnjë çelës, asnjë miratim nga Meta, asnjë faturë.
 */
export function waLink(phone: string, text: string): string | null {
  const number = waNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

type BookingFacts = {
  businessName: string;
  serviceName: string;
  customerName: string;
  /** Data dhe ora të formatuara tashmë në gjuhën e duhur. */
  date: string;
  time: string;
  businessPhone?: string | null;
};

/** Konfirmimi që merr klienti sapo rezervon. */
export function confirmationText(b: BookingFacts): string {
  const call = b.businessPhone ? `\nPër çdo ndryshim: ${b.businessPhone}` : "";
  return (
    `Përshëndetje ${b.customerName}! Rezervimi juaj te ${b.businessName} u konfirmua.\n` +
    `${b.serviceName}\n${b.date}, ora ${b.time}.${call}`
  );
}

/** Kujtesa para takimit. */
export function reminderText(b: BookingFacts): string {
  const call = b.businessPhone ? ` Nëse nuk mund të vini, na njoftoni: ${b.businessPhone}` : "";
  return (
    `Përshëndetje ${b.customerName}! Ju kujtojmë takimin te ${b.businessName}: ` +
    `${b.serviceName}, ${b.date} në orën ${b.time}.${call}`
  );
}

/** Njoftimi që merr pronari kur mbërrin një rezervim i ri. */
export function ownerAlertText(b: BookingFacts & { customerPhone?: string | null }): string {
  const phone = b.customerPhone ? `\n${b.customerPhone}` : "";
  return (
    `Rezervim i ri: ${b.customerName}\n` +
    `${b.serviceName}\n${b.date}, ora ${b.time}${phone}`
  );
}

/** Mesazh i lirë drejt një klienti — pika e nisjes për "shkruaji klientit". */
export function openingText(customerName: string, businessName: string): string {
  return `Përshëndetje ${customerName}! Ju shkruajmë nga ${businessName}.`;
}
