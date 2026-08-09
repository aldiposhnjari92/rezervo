/**
 * A mbërrijnë vërtet njoftimet live?
 *
 * Kjo është pjesa që testet HTTP nuk e prekin dot: abonimi realtime ndodh në
 * shfletues. Këtu përdoret i njëjti `supabase-js` me të njëjtin token si faqja,
 * ndaj nëse ngjarja mbërrin këtu, mbërrin edhe te zilja.
 *
 * Mbulon pikërisht gabimin që kishim: pa `realtime.setAuth()`, socket-i lidhet
 * si `anon`, RLS-ja i heq të gjitha ngjarjet dhe nuk shfaqet asnjë gabim —
 * thjesht heshtje.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..", "..");
const ENV = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const BASE = process.env.BASE || "http://localhost:3100";
const A = require("./actions.json");

let pass = 0, fail = 0;
const failures = [];
const check = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, failures.push(l), console.log("  FAIL " + l + (d ? "\n         " + d : "")));

const REF = SUPABASE_URL.replace("https://", "").split(".")[0];
function cookieFor(session) {
  const v = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const n = `sb-${REF}-auth-token`, C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  return Array.from({ length: Math.ceil(v.length / C) },
    (_, i) => `${n}.${i}=${v.slice(i * C, (i + 1) * C)}`).join("; ");
}

const PW = "TestPass123!";
const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const stamp = Date.now();
  /**
   * Numër i freskët klienti për çdo drejtim testesh.
   *
   * Kufizuesi i shpejtësisë numëron PËR NUMËR (10 përpjekje/orë). Me numra fiksë
   * në kod, vetë suita e ngop kuotën pas disa drejtimesh dhe fillon të dështojë
   * pa pasur asnjë defekt në aplikacion. Stampa e kohës e mban çdo drejtim në
   * kovën e vet, ndërsa `n` i mban klientët të dallueshëm brenda një drejtimi.
   */
  const custPhone = (n) => "069" + String(stamp).slice(-6) + n;

  const email = `rezervo.rt.${stamp}@gmail.com`;
  const slug = `rt-berber-${stamp}`;

  console.log("\n=== 1. Setup ===");
  await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }) }).then((r) => r.json());
  const session = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }) }).then((r) => r.json());
  check("signed in", Boolean(session.access_token));

  const cookie = cookieFor(session);
  const act = (p, name, args) => fetch(BASE + p, { method: "POST", redirect: "manual",
    headers: { cookie, "Next-Action": A[name], "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(args) });

  const MON = { start: "09:00", end: "18:00" };
  await act("/setup", "createBusiness", [{ name: "Realtime Berberi", slug, phone: "",
    workingHours: { monday: MON, tuesday: MON, wednesday: MON, thursday: MON, friday: MON,
      saturday: MON, sunday: null } }]);
  await act("/services", "createService", [{ name: "Prerje", durationMinutes: 30, price: 500 }]);

  const pub = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug }) }).then((r) => r.json());
  check("business is live", pub && pub.services.length === 1);
  const businessId = pub.id;
  const serviceId = pub.services[0].id;

  // ------------------------------------------------------------------------
  //  Klienti realtime, i ndërtuar si te shfletuesi
  // ------------------------------------------------------------------------
  console.log("\n=== 2. Subscribe the way the browser does ===");
  const supabase = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  supabase.realtime.setAuth(session.access_token);

  const received = [];
  let status = "";

  const channel = supabase
    .channel(`notifications:${businessId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications",
        filter: `business_id=eq.${businessId}` },
      (payload) => received.push(payload.new))
    .subscribe((s) => { status = s; });

  for (let i = 0; i < 40 && status !== "SUBSCRIBED"; i++) await waitFor(250);
  check("channel subscribed", status === "SUBSCRIBED", `status=${status}`);

  // ------------------------------------------------------------------------
  console.log("\n=== 3. A customer booking pushes an event ===");
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  const startIso = new Date(`${d.toISOString().slice(0, 10)}T08:00:00Z`).toISOString();

  const booked = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_service_id: serviceId, p_customer_name: "Ana Hoxha",
      p_customer_phone: custPhone(1), p_start_time: startIso }) }).then((r) => r.json());
  check("booking created", booked.ok === true, JSON.stringify(booked).slice(0, 140));

  for (let i = 0; i < 40 && received.length === 0; i++) await waitFor(250);
  check("event arrived live, without any refresh", received.length === 1,
    `received=${received.length} — RLS drops everything if setAuth() is missing`);
  check("it is the new-booking notification",
    received[0]?.kind === "booking_new", JSON.stringify(received[0] ?? {}).slice(0, 140));
  check("carries the customer name",
    (received[0]?.title || "").includes("Ana Hoxha"), received[0]?.title);
  check("arrives unread", received[0]?.read_at === null);

  // ------------------------------------------------------------------------
  console.log("\n=== 4. Suspension pushes an event too ===");
  const before = received.length;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_service_id: serviceId, p_customer_name: "Beni Shala",
      p_customer_phone: custPhone(2),
      p_start_time: new Date(new Date(startIso).getTime() + 3600e3).toISOString() }) })
    .then((r) => r.json());

  for (let i = 0; i < 40 && received.length === before; i++) await waitFor(250);
  check("second booking also pushed", received.length === before + 1,
    `received=${received.length}`);

  // ------------------------------------------------------------------------
  console.log("\n=== 5. Another owner's socket stays silent ===");
  const otherEmail = `rezervo.rt.other.${stamp}@gmail.com`;
  await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: otherEmail, password: PW }) }).then((r) => r.json());
  const otherSession = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: otherEmail, password: PW }) }).then((r) => r.json());

  const intruder = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  intruder.realtime.setAuth(otherSession.access_token);

  const stolen = [];
  let intruderStatus = "";
  const intruderChannel = intruder
    .channel(`intruder:${businessId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications",
        filter: `business_id=eq.${businessId}` },
      (payload) => stolen.push(payload.new))
    .subscribe((s) => { intruderStatus = s; });

  for (let i = 0; i < 40 && intruderStatus !== "SUBSCRIBED"; i++) await waitFor(250);

  await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_service_id: serviceId, p_customer_name: "Dora Leka",
      p_customer_phone: custPhone(3),
      p_start_time: new Date(new Date(startIso).getTime() + 7200e3).toISOString() }) })
    .then((r) => r.json());

  await waitFor(4000);
  check("owner received it", received.length === before + 2, `received=${received.length}`);
  check("the other owner received NOTHING", stolen.length === 0,
    `leaked ${stolen.length} events to a different business's owner`);

  await supabase.removeChannel(channel);
  await intruder.removeChannel(intruderChannel);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP=" + email);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
