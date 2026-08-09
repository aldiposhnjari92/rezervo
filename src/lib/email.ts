import "server-only";

import type { EmailContent } from "./email-templates";

/**
 * Dërgimi i email-eve.
 *
 * Provider-i është Resend, i thirrur me `fetch` — pa SDK, pa varësi të re.
 * Free tier-i i tij (3.000 email/muaj) e mban projektin brenda kufirit $0.
 *
 * Nëse `RESEND_API_KEY` nuk është vendosur, funksioni NUK dështon: e shkruan
 * email-in në log dhe kthen `sent: false`. Kështu zhvillimi dhe testet nuk
 * kërkojnë çelës, dhe asnjë veprim i aplikacionit nuk bllokohet nga posta.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/** Adresa e nisësit. Për provë, Resend lejon `onboarding@resend.dev`. */
const FROM = process.env.EMAIL_FROM || "Rezervo.al <onboarding@resend.dev>";

export type EmailResult = {
  sent: boolean;
  provider: "resend" | "mock";
  /** Arsyeja kur `sent` është false — për log, jo për t'u treguar klientit. */
  reason?: string;
};

export type Email = EmailContent & { to: string };

/**
 * Dërgon një email. NUK hedh kurrë përjashtim.
 *
 * Posta është "best effort": nëse dështon, veprimi që e nisi (p.sh. pezullimi)
 * duhet të mbetet i kryer. Prandaj çdo gabim kthehet, jo hidhet.
 */
export async function sendEmail(email: Email): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `[email:mock] -> ${email.to}\n  subject: ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`,
    );
    return { sent: false, provider: "mock", reason: "RESEND_API_KEY mungon" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false, provider: "resend", reason: `HTTP ${res.status}` };
    }

    return { sent: true, provider: "resend" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "gabim i panjohur";
    console.error(`[email] dështoi: ${reason}`);
    return { sent: false, provider: "resend", reason };
  } finally {
    clearTimeout(timer);
  }
}
