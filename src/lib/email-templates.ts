/**
 * Përmbajtja e email-eve — funksione të pastra, pa çelësa dhe pa rrjet.
 *
 * E ndarë nga `email.ts` me qëllim: ai skedar mban çelësin e API-t dhe është
 * `server-only`, ndaj nuk testohet dot jashtë Next-it. Këtu nuk ka asgjë sekrete,
 * kështu që shabllonet mbulohen me teste njësi.
 */

export type EmailContent = { subject: string; html: string; text: string };

// ---------------------------------------------------------------------------
//  Shabllon
// ---------------------------------------------------------------------------

/** Ikën në HTML — përmbajtja vjen nga admini, ndaj nuk i besohet. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Kornizë e thjeshtë HTML për email.
 *
 * Tabela dhe stile inline me qëllim: klientët e email-it (Outlook veçanërisht)
 * nuk mbështesin flexbox, grid, apo CSS të jashtëm.
 */
function layout(params: { heading: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html lang="sq">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e4df;border-radius:12px;">
        <tr><td style="padding:28px 32px 0 32px;">
          <p style="margin:0;font:600 16px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
            Rezervo<span style="color:#2563eb;">.al</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px 0 32px;">
          <h1 style="margin:0;font:600 20px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
            ${escapeHtml(params.heading)}
          </h1>
        </td></tr>
        <tr><td style="padding:16px 32px 28px 32px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">
          ${params.body}
        </td></tr>
        ${
          params.footer
            ? `<tr><td style="padding:0 32px 28px 32px;border-top:1px solid #e6e4df;">
                 <p style="margin:16px 0 0 0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#71717a;">
                   ${params.footer}
                 </p>
               </td></tr>`
            : ""
        }
      </table>
      <p style="margin:16px 0 0 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#a1a1aa;">
        Rezervo.al
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
//  Pezullimi
// ---------------------------------------------------------------------------

/**
 * Email-i që merr pronari kur biznesi i pezullohet.
 *
 * Nëse admini ka shkruar një arsye, ajo i përcillet fjalë për fjalë. Nëse jo,
 * dërgohet një mesazh i përgjithshëm — pronari duhet ta dijë gjithsesi që faqja
 * i ka rënë, edhe pa e ditur pse.
 */
export function suspensionEmail(params: {
  businessName: string;
  reason?: string | null;
}): EmailContent {
  const name = params.businessName;
  const reason = params.reason?.trim();

  const explanation = reason
    ? `<p style="margin:0 0 16px 0;">Arsyeja e dhënë nga ekipi ynë:</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr><td style="border-left:3px solid #d97706;background:#fffbeb;padding:12px 16px;border-radius:0 6px 6px 0;">
           ${escapeHtml(reason)}
         </td></tr>
       </table>`
    : `<p style="margin:0 0 16px 0;">
         Pezullimi është bërë nga ekipi ynë gjatë një kontrolli të llogarive.
         Nëse mendoni se ka ndodhur një gabim, na shkruani dhe e shohim menjëherë.
       </p>`;

  const html = layout({
    heading: `${name} është pezulluar`,
    body: `
      <p style="margin:0 0 16px 0;">Përshëndetje,</p>
      <p style="margin:0 0 16px 0;">
        Faqja juaj publike e rezervimeve për <strong>${escapeHtml(name)}</strong> është
        pezulluar përkohësisht. Klientët nuk mund të hapin linkun tuaj dhe nuk pranohen
        rezervime të reja.
      </p>
      ${explanation}
      <p style="margin:16px 0 0 0;">
        <strong>Të dhënat tuaja nuk janë prekur.</strong> Rezervimet, shërbimet dhe historiku
        i klientëve janë të gjitha aty, dhe kthehen sapo llogaria të riaktivizohet.
      </p>`,
    footer:
      "Për çdo pyetje, thjesht përgjigjuni këtij email-i. Ky është një njoftim automatik nga Rezervo.al.",
  });

  const text = [
    `${name} është pezulluar`,
    "",
    "Përshëndetje,",
    "",
    `Faqja juaj publike e rezervimeve për ${name} është pezulluar përkohësisht.`,
    "Klientët nuk mund të hapin linkun tuaj dhe nuk pranohen rezervime të reja.",
    "",
    reason
      ? `Arsyeja e dhënë nga ekipi ynë:\n${reason}`
      : "Pezullimi është bërë nga ekipi ynë gjatë një kontrolli të llogarive.\nNëse mendoni se ka ndodhur një gabim, na shkruani dhe e shohim menjëherë.",
    "",
    "Të dhënat tuaja nuk janë prekur. Rezervimet, shërbimet dhe historiku i",
    "klientëve janë të gjitha aty, dhe kthehen sapo llogaria të riaktivizohet.",
    "",
    "Për çdo pyetje, thjesht përgjigjuni këtij email-i.",
    "Rezervo.al",
  ].join("\n");

  return { subject: `${name} — llogaria juaj është pezulluar`, html, text };
}

// ---------------------------------------------------------------------------
//  Riaktivizimi
// ---------------------------------------------------------------------------

/**
 * Email-i që merr pronari kur biznesi i rikthehet online.
 *
 * Pezullimi e njofton pronarin; heshtja pas rikthimit do të thoshte që ai nuk e
 * di kurrë se faqja i punon sërish — dhe vazhdon të mos i dërgojë klientët atje.
 */
export function restorationEmail(params: { businessName: string }): EmailContent {
  const name = params.businessName;

  const html = layout({
    heading: `${name} është sërish online`,
    body: `
      <p style="margin:0 0 16px 0;">Përshëndetje,</p>
      <p style="margin:0 0 16px 0;">
        Pezullimi i llogarisë suaj është hequr. Faqja publike e rezervimeve për
        <strong>${escapeHtml(name)}</strong> është sërish e hapur dhe pranon rezervime.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-left:3px solid #059669;background:#ecfdf5;padding:12px 16px;border-radius:0 6px 6px 0;">
          Rezervimet, shërbimet dhe klientët tuaj janë pikërisht si i latë.
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;">
        Nuk keni nevojë të bëni asgjë — mjafton të ndani sërish linkun tuaj me klientët.
      </p>`,
    footer:
      "Për çdo pyetje, thjesht përgjigjuni këtij email-i. Ky është një njoftim automatik nga Rezervo.al.",
  });

  const text = [
    `${name} është sërish online`,
    "",
    "Përshëndetje,",
    "",
    "Pezullimi i llogarisë suaj është hequr. Faqja publike e rezervimeve për",
    `${name} është sërish e hapur dhe pranon rezervime.`,
    "",
    "Rezervimet, shërbimet dhe klientët tuaj janë pikërisht si i latë.",
    "",
    "Nuk keni nevojë të bëni asgjë — mjafton të ndani sërish linkun me klientët.",
    "",
    "Rezervo.al",
  ].join("\n");

  return { subject: `${name} — llogaria juaj është riaktivizuar`, html, text };
}
