import "server-only";

import type { EmailContent } from "./email-templates";
import { activeProvider, PROVIDER_ENV, parseFrom, type ProviderName } from "./email-provider";

/**
 * Dërgimi i email-eve.
 *
 * Provider-i nuk është i ngulitur në kod: zgjidhet nga çelësi që gjendet në
 * mjedis. Të dy provider-at fliten me `fetch` mbi HTTP — pa SDK, pa varësi të re,
 * dhe pa u lidhur përgjithmonë me njërin prej tyre.
 *
 *   RESEND_API_KEY  -> Resend   (3.000 email/muaj falas)
 *   BREVO_API_KEY   -> Brevo    (300 email/ditë falas, serverë në BE)
 *   asnjë çelës     -> log      (zhvillim dhe teste)
 *
 * Për një provider tjetër, shtoje te `PROVIDERS` më poshtë — asgjë tjetër në
 * aplikacion nuk ka nevojë të ndryshojë.
 */

const TIMEOUT_MS = 10_000;

/** Adresa e nisësit, p.sh. `Rezervo.al <njoftime@rezervo.al>`. */
const FROM = process.env.EMAIL_FROM || "Rezervo.al <onboarding@resend.dev>";

export type EmailResult = {
  sent: boolean;
  provider: ProviderName;
  /** Arsyeja kur `sent` është false — për log, jo për t'u treguar klientit. */
  reason?: string;
};

export type Email = EmailContent & { to: string };

type Provider = {
  request: (email: Email, apiKey: string) => { url: string; init: RequestInit };
};

const PROVIDERS: Record<Exclude<ProviderName, "none">, Provider> = {
  resend: {
    request: (email, apiKey) => ({
      url: "https://api.resend.com/emails",
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      },
    }),
  },

  brevo: {
    request: (email, apiKey) => {
      const sender = parseFrom(FROM);
      return {
        url: "https://api.brevo.com/v3/smtp/email",
        init: {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: sender.address, ...(sender.name ? { name: sender.name } : {}) },
            to: [{ email: email.to }],
            subject: email.subject,
            htmlContent: email.html,
            textContent: email.text,
          }),
        },
      };
    },
  },
};

/**
 * Dërgon një email. NUK hedh kurrë përjashtim.
 *
 * Posta është "best effort": nëse dështon, veprimi që e nisi (p.sh. pezullimi)
 * duhet të mbetet i kryer. Prandaj çdo gabim kthehet, jo hidhet.
 */
export async function sendEmail(email: Email): Promise<EmailResult> {
  const name = activeProvider();

  if (name === "none") {
    console.log(
      `[email:log] -> ${email.to}\n  subject: ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`,
    );
    return { sent: false, provider: "none", reason: "asnjë provider i konfiguruar" };
  }

  const provider = PROVIDERS[name];
  const apiKey = process.env[PROVIDER_ENV[name]]!;
  const { url, init } = provider.request(email, apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] ${name} ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false, provider: name, reason: `HTTP ${res.status}` };
    }

    return { sent: true, provider: name };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "gabim i panjohur";
    console.error(`[email] ${name} dështoi: ${reason}`);
    return { sent: false, provider: name, reason };
  } finally {
    clearTimeout(timer);
  }
}

export { activeProvider };
