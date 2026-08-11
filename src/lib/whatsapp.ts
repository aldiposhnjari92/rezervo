import "server-only";

import {
  waNumber,
  whatsappRoute,
  type WhatsAppRoute,
} from "./whatsapp-messages";

/**
 * Dërgimi i vërtetë përmes WhatsApp Cloud API (Meta).
 *
 * DY GJËRA QË E BËJNË KËTË TË NDRYSHËM NGA EMAIL-I:
 *
 * 1. Meta lejon tekst të lirë vetëm brenda 24 orëve pasi klienti të ketë shkruar
 *    i pari. Klientët tanë rezervojnë nga një formular në web, jo nga WhatsApp-i,
 *    ndaj ajo dritare nuk hapet kurrë. Mesazhet e nisura nga ne duhet të jenë
 *    SHABLLONE të miratuara nga Meta. Prandaj `template` është rruga kryesore
 *    këtu, dhe teksti i lirë mbetet vetëm si rrugë ndihmëse.
 *
 * 2. Çdo bisedë faturohet. Pa `WHATSAPP_TOKEN` dhe `WHATSAPP_PHONE_ID`, asgjë
 *    nuk niset vetë dhe aplikacioni mbetet te linqet `wa.me` — falas.
 *
 * Si posta: nuk hedh kurrë përjashtim. Një rezervim i kryer nuk prishet sepse
 * njoftimi dështoi.
 */

const API_VERSION = "v21.0";
const TIMEOUT_MS = 8000;

export type WhatsAppResult = {
  sent: boolean;
  route: WhatsAppRoute;
  reason?: string;
};

/** Emrat e shablloneve, nëse janë miratuar te Meta. */
export const TEMPLATE_ENV = {
  confirmation: "WHATSAPP_TEMPLATE_CONFIRMATION",
  reminder: "WHATSAPP_TEMPLATE_REMINDER",
  ownerAlert: "WHATSAPP_TEMPLATE_OWNER_ALERT",
} as const;

export type TemplateKind = keyof typeof TEMPLATE_ENV;

function payload(to: string, text: string, kind: TemplateKind, params: string[]) {
  const template = process.env[TEMPLATE_ENV[kind]]?.trim();

  if (template) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "sq" },
        components: [
          {
            type: "body",
            parameters: params.map((value) => ({ type: "text", text: value })),
          },
        ],
      },
    };
  }

  // Pa shabllon: teksti i lirë kalon vetëm brenda dritares 24-orëshe.
  return { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
}

/**
 * Dërgon një mesazh. Kthen `sent:false` me arsye kur nuk ka konfigurim —
 * thirrësi vendos nëse i ofron pronarit një link për ta dërguar vetë.
 */
export async function sendWhatsApp(input: {
  to: string;
  text: string;
  kind: TemplateKind;
  /** Vlerat që zënë {{1}}, {{2}}… te shablloni, në atë radhë. */
  params: string[];
}): Promise<WhatsAppResult> {
  const route = whatsappRoute();

  if (route === "link") {
    console.log(`[whatsapp:link] -> ${input.to}\n  ${input.text.replace(/\n/g, "\n  ")}`);
    return { sent: false, route, reason: "pa çelësa — përdoret linku wa.me" };
  }

  const number = waNumber(input.to);
  if (!number) return { sent: false, route, reason: "numër i pavlefshëm" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload(number, input.text, input.kind, input.params)),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[whatsapp] ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false, route, reason: `HTTP ${res.status}` };
    }

    return { sent: true, route };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "gabim i panjohur";
    console.error(`[whatsapp] dështoi: ${reason}`);
    return { sent: false, route, reason };
  } finally {
    clearTimeout(timer);
  }
}
