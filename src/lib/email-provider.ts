/**
 * Zgjedhja e provider-it të email-it — logjikë e pastër, pa çelësa dhe pa rrjet.
 *
 * E ndarë nga `email.ts` (që është `server-only` dhe s'ngarkohet dot jashtë
 * Next-it) që kjo pjesë të mbulohet me teste: një gabim këtu do të thoshte ose
 * email-e që nuk dërgohen kurrë, ose një çelës i dërguar te provider-i i gabuar.
 */

export type ProviderName = "resend" | "brevo" | "none";

/** Cili variabël mjedisi ndez cilin provider. */
export const PROVIDER_ENV: Record<Exclude<ProviderName, "none">, string> = {
  resend: "RESEND_API_KEY",
  brevo: "BREVO_API_KEY",
};

/** Renditja e provës kur nuk është detyruar asnjë provider. */
const ORDER: Exclude<ProviderName, "none">[] = ["resend", "brevo"];

/** `Emri <adresa@shembull.com>` -> { name, address }. */
export function parseFrom(value: string): { name?: string; address: string } {
  const match = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(value);
  if (match) return { name: match[1] || undefined, address: match[2].trim() };
  return { address: value.trim() };
}

/**
 * Cili provider është i konfiguruar.
 *
 * `EMAIL_PROVIDER` e detyron zgjedhjen. Nëse detyrohet një provider që nuk ka
 * çelës, kthehet `none` — JO një rënie e heshtur te provider-i tjetër, sepse
 * dërgimi nga një adresë tjetër nga ajo që pret pronari është më keq se asgjë.
 */
export function activeProvider(env: NodeJS.ProcessEnv = process.env): ProviderName {
  const forced = env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (forced === "none") return "none";
  if (forced === "resend" || forced === "brevo") {
    return env[PROVIDER_ENV[forced]] ? forced : "none";
  }

  // Vlerë e panjohur ose e paplotësuar: bie te zbulimi automatik.
  for (const name of ORDER) {
    if (env[PROVIDER_ENV[name]]) return name;
  }
  return "none";
}
