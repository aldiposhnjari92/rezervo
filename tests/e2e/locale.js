/**
 * Asnjë faqe nuk duhet të lërë shqip kur gjuha është anglisht.
 *
 * Ekziston sepse përkthimi u bë skedar pas skedari dhe gjërat harroheshin pa u
 * vënë re: titulli i kalendarit mbeti "10 – 16 Gusht 2026" në gjithë panelin
 * anglisht, sepse emrat e muajve ishin listë e ngurtë brenda `lib/calendar.ts`.
 * Tipi i fjalorit e kap çelësin që MUNGON; nuk kap dot tekstin e fiksuar që nuk
 * kaloi kurrë nga fjalori.
 *
 * Kërkohet te teksti i DUKSHËM, jo te HTML-ja e plotë: klasat, komentet dhe
 * atributet nuk i sheh përdoruesi. Fjalët e kërkuara janë vetëm shqipe — pa
 * emra biznesesh apo klientësh, që janë të dhëna e jo ndërfaqe.
 */
const fs = require("fs");
const ENV = fs.readFileSync(process.cwd() + "/.env.local", "utf8");
const SB = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const REF = SB.replace("https://", "").split(".")[0];
const ACT = require(process.cwd() + "/tests/e2e/actions.json");
const BASE = "http://localhost:3100";

const norm = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function cookieHeader(sess) {
  const v = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
  const n = `sb-${REF}-auth-token`, C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  const p = [];
  for (let i = 0; i * C < v.length; i++) p.push(`${n}.${i}=${v.slice(i * C, (i + 1) * C)}`);
  return p.join("; ");
}

/** Fjalë që ekzistojnë VETËM në shqip — pa emra biznesesh apo klientësh. */
const ALBANIAN = [
  "Rezervim", "rezervime", "Shërbim", "shërbime", "Klient", "klientë", "Orari",
  "Ditë", "ditë", "Muaj", "Javë", "Gusht", "Korrik", "Shtator", "Nëntor", "Dhjetor",
  "Janar", "Shkurt", "Prill", "Qershor", "Tetor", "E hënë", "E martë", "E mërkurë",
  "E enjte", "E premte", "E shtunë", "E diel", "Konfirmuar", "Anuluar", "Përfunduar",
  "Nuk erdhi", "Falas", "Ruaj", "Anulo", "Fshi", "Ndrysho", "Shto", "Hyr", "Dil",
  "Kthehu", "Provo", "Zgjidh", "Emri", "Telefoni", "Çmimi", "gjithsej", "Pezulluar",
  "Llogaria", "Rregullimet", "Paneli", "Kalendari", "Të ardhurat", "Mbyllur",
];

function visibleText(html) {
  const body = html.slice(html.indexOf("<body"));
  return body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

(async () => {
  const stamp = Date.now();
  const email = `rezervo.sweep.${stamp}@gmail.com`, password = "TestPass123!";
  await fetch(`${SB}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(r => r.json());
  const sess = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(r => r.json());
  const COOKIE = cookieHeader(sess) + "; rezervo-locale=en";
  const act = (p, n, a) => fetch(BASE + p, { method: "POST", redirect: "manual",
    headers: { cookie: COOKIE, "Next-Action": ACT[n], "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(a) });

  const hours = { monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" },
    wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" },
    friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "14:00" },
    sunday: { start: "09:00", end: "18:00" } };
  const slug = `sweep-${stamp}`;
  await act("/setup", "createBusiness", [{ name: "Sweep Shop", slug, phone: "069 123 4567", workingHours: hours }]);
  await act("/services", "createService", [{ name: "Haircut", durationMinutes: 30, price: 500 }]);
  const svc = await fetch(`${SB}/rest/v1/services?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${sess.access_token}` } }).then(r => r.json());
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await act("/calendar", "createManualBooking", [{ serviceId: svc[0].id, customerName: "Test Person",
    customerPhone: "", startTime: new Date(`${day}T08:00:00Z`).toISOString(), note: "" }]);

  const pages = ["/", "/login", "/login?mode=signup", "/dashboard", "/customers", "/services",
    "/calendar?view=day", "/calendar?view=week", "/calendar?view=month",
    "/settings?tab=biznesi", "/settings?tab=orari", "/settings?tab=rregullat", "/settings?tab=llogaria",
    "/account", "/" + slug];

  let bad = 0;
  for (const p of pages) {
    const res = await fetch(BASE + p, { headers: { cookie: COOKIE } });
    const text = norm(visibleText(await res.text()));
    const found = [...new Set(ALBANIAN.filter((w) => text.includes(w)))];
    if (found.length) {
      bad++;
      console.log(`\n${p}`);
      for (const w of found) {
        const i = text.indexOf(w);
        console.log(`   "${w}"  …${text.slice(Math.max(0, i - 45), i + 45).trim()}…`);
      }
    }
  }
  console.log(bad ? `\n${bad} page(s) with Albanian left` : `\n${pages.length} passed, 0 failed`);
  console.log("CLEANUP=" + email);
  if (bad) process.exit(1);
})();
