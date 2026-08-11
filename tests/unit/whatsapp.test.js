/**
 * WhatsApp: zgjedhja e rrugës, linqet dhe tekstet.
 *
 * Këto shkojnë te telefonat e klientëve të vërtetë, ndaj janë pjesa që duhet
 * mbuluar: një link i keq nuk hapet fare, dhe një tekst i keq lexohet nga dikush.
 * Dërgimi vetë (`whatsapp.ts`) është `server-only` dhe nuk provohet këtu.
 */
const path = require("path");

let pass = 0, fail = 0;
const eq = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, console.log("  FAIL " + l + (d ? "\n         " + d : "")));

const MODULE = path.join(__dirname, "..", ".build", "whatsapp-messages.js");
const w = require(MODULE);

const BOOKING = {
  businessName: "Berberi Ilir",
  serviceName: "Prerje flokësh",
  customerName: "Ana",
  date: "14 Gusht",
  time: "10:30",
  businessPhone: "069 123 4567",
};

console.log("\n=== 1. Rruga varet nga çelësat ===");
{
  eq("pa çelësa -> link", w.whatsappRoute({}) === "link");
  eq("vetëm token -> link", w.whatsappRoute({ WHATSAPP_TOKEN: "t" }) === "link");
  eq("vetëm phone id -> link", w.whatsappRoute({ WHATSAPP_PHONE_ID: "1" }) === "link");
  eq("të dyja -> cloud", w.whatsappRoute({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1" }) === "cloud");
  // Një variabël bosh është po aq e pavlefshme sa mungesa.
  eq("bosh -> link", w.whatsappRoute({ WHATSAPP_TOKEN: "  ", WHATSAPP_PHONE_ID: "1" }) === "link");
}

console.log("\n=== 2. Numri për WhatsApp ===");
{
  eq("heq +", w.waNumber("+355691234567") === "355691234567");
  eq("heq hapësirat", w.waNumber("+355 69 123 4567") === "355691234567");
  eq("numër i shkurtër -> null", w.waNumber("12") === null);
  eq("tekst -> null", w.waNumber("pa numër") === null);
}

console.log("\n=== 3. Linku wa.me ===");
{
  const link = w.waLink("+355691234567", "Përshëndetje Ana!");
  eq("nis me wa.me", link.startsWith("https://wa.me/355691234567?text="));
  // Teksti duhet i koduar: pa këtë, hapësirat dhe rreshtat e prishin linkun.
  eq("teksti i koduar", link.includes("P%C3%ABrsh%C3%ABndetje%20Ana!"), link);
  eq("pa hapësira të papërpunuara", !link.slice(link.indexOf("?text=")).includes(" "));
  eq("numër i pavlefshëm -> null", w.waLink("abc", "x") === null);

  const multi = w.waLink("+355691234567", "rreshti 1\nrreshti 2");
  eq("rreshti i ri i koduar", multi.includes("%0A"), multi);
}

console.log("\n=== 4. Tekstet ===");
{
  const c = w.confirmationText(BOOKING);
  eq("konfirmimi ka emrin e klientit", c.includes("Ana"));
  eq("konfirmimi ka biznesin", c.includes("Berberi Ilir"));
  eq("konfirmimi ka shërbimin", c.includes("Prerje flokësh"));
  eq("konfirmimi ka datën dhe orën", c.includes("14 Gusht") && c.includes("10:30"));
  eq("konfirmimi ka telefonin kur ekziston", c.includes("069 123 4567"));
  eq(
    "pa telefon, pa rresht bosh",
    !w.confirmationText({ ...BOOKING, businessPhone: null }).includes("Për çdo ndryshim"),
  );

  const r = w.reminderText(BOOKING);
  eq("kujtesa e përmend takimin", r.toLowerCase().includes("kujtojmë"));
  eq("kujtesa ka datën", r.includes("14 Gusht"));

  const o = w.ownerAlertText({ ...BOOKING, customerPhone: "069 123 4567" });
  eq("njoftimi i pronarit nis me 'Rezervim i ri'", o.startsWith("Rezervim i ri"));
  eq("njoftimi ka numrin e klientit", o.includes("069 123 4567"));
  eq(
    "pa numër klienti, pa rresht të varur",
    !w.ownerAlertText({ ...BOOKING, customerPhone: null }).endsWith("\n"),
  );

  eq("mesazhi i hapjes i drejtohet klientit", w.openingText("Ana", "Berberi Ilir") === "Përshëndetje Ana! Ju shkruajmë nga Berberi Ilir.");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
