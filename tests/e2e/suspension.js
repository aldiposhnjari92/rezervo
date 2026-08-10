/**
 * Një biznes i pezulluar është vetëm për lexim — e provuar nga jashtë.
 *
 * PHASE=1  krijon pronarin (viktimën) dhe një llogari që do të bëhet admin;
 *          shtyp ID-në që duhet ngritur me SQL.
 * PHASE=2  pezullon biznesin dhe provon çdo rrugë shkrimi:
 *          server action-et e aplikacionit DHE PostgREST-in direkt.
 *
 * Rruga direkte është ajo që ka rëndësi. Çelësi `anon` ndodhet në çdo bundle,
 * ndaj një pronar i pezulluar mund t'i flasë bazës pa kaluar fare nga Next-i.
 * Nëse ndalimi do të ishte vetëm te server action-et, kjo suitë do ta kapte.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const BASE = process.env.BASE || "http://localhost:3100";
const PHASE = process.env.PHASE || "1";
const STATE = path.join(__dirname, ".suspension-state.json");
const ENV = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const REF = SUPABASE_URL.replace("https://", "").split(".")[0];
const ACTIONS = require("./actions.json");

const norm = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail = "") {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; failures.push(label); console.log("  FAIL " + label + (detail ? "\n         " + detail : "")); }
}

function cookieFor(session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const CHUNK = 3180;
  if (value.length <= CHUNK) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++)
    parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return parts.join("; ");
}

const get = (p, cookie) => fetch(BASE + p, { redirect: "manual", headers: cookie ? { cookie } : {} });

async function callAction(p, name, args, cookie) {
  const res = await fetch(BASE + p, {
    method: "POST", redirect: "manual",
    headers: { cookie, "Next-Action": ACTIONS[name], "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(args),
  });
  return { status: res.status, text: norm(await res.text()) };
}

/** PostgREST direkt, me JWT-në e përdoruesit — rruga që anashkalon Next-in. */
async function restWrite(method, query, token, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    method,
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let rows = null;
  try { rows = JSON.parse(text); } catch { /* trup jo-JSON */ }
  return { status: res.status, rows, text };
}

const restRead = (query, token) =>
  fetch(`${SUPABASE_URL}/rest/v1/${query}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then((r) => r.json());

const rpcAs = (fn, body, token) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

async function signUp(email, password) {
  await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
}

/** Një numër i freskët për çdo drejtim — kufiri numëron për numër. */
const PASSWORD = "TestPass123!";

// =========================================================================
(async () => {
  if (PHASE === "1") {
    const stamp = Date.now();
    const state = {
      owner: `rezervo.susp.owner.${stamp}@gmail.com`,
      admin: `rezervo.susp.admin.${stamp}@gmail.com`,
      slug: `susp-berber-${stamp}`,
      stamp,
    };

    console.log("\n=== 1. Setup: një pronar me dyqan ===");
    const ownerSession = await signUp(state.owner, PASSWORD);
    if (!ownerSession.access_token) {
      console.log("  !! s'u kyç dot:", JSON.stringify(ownerSession).slice(0, 200));
      process.exit(2);
    }
    const cookie = cookieFor(ownerSession);
    state.ownerId = ownerSession.user.id;

    const hours = {
      monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" },
      wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" },
      friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "14:00" },
      sunday: null,
    };
    const created = await callAction("/setup", "createBusiness",
      [{ name: "Susp Berberi", slug: state.slug, phone: "069 111 2233", workingHours: hours }], cookie);
    check("biznesi u krijua", created.status === 303, `status=${created.status}`);

    const svc = await callAction("/services", "createService",
      [{ name: "Prerje flokesh", durationMinutes: 30, price: 500 }], cookie);
    check("shërbimi u shtua", svc.status === 200 && !svc.text.includes("Nuk u shtua"));

    const services = await restRead(`services?select=id,name`, ownerSession.access_token);
    check("shërbimi lexohet", Array.isArray(services) && services.length === 1);
    state.serviceId = services[0]?.id;

    const business = await restRead(`businesses?select=id`, ownerSession.access_token);
    state.businessId = business[0]?.id;

    const adminSession = await signUp(state.admin, PASSWORD);
    state.adminId = adminSession.user?.id ?? adminSession.id;

    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    console.log(`\nPHASE 1: ${pass} passed, ${fail} failed`);
    if (fail) { console.log("failed:\n" + failures.map((f) => " - " + f).join("\n")); process.exit(1); }
    console.log(`\nPROMOTE=${state.adminId}`);
    return;
  }

  // ---------------------------------------------------------------- PHASE 2
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const ownerSession = await signUp(state.owner, PASSWORD);
  const adminSession = await signUp(state.admin, PASSWORD);
  const cookie = cookieFor(ownerSession);
  const adminCookie = cookieFor(adminSession);
  const token = ownerSession.access_token;
  // Orë unike për drejtim: një orë e zënë do ta maskonte gabimin e pezullimit.
  const slotIso = new Date(Date.now() + 86400000 + (state.stamp % 60) * 60000).toISOString();

  console.log("\n=== 2. Admini e pezullon biznesin ===");
  {
    const r = await callAction(`/admin/${state.ownerId}`, "setBusinessSuspended",
      [{ businessId: state.businessId, suspended: true, reason: "Provë e pezullimit" }], adminCookie);
    check("pezullimi kaloi", r.status === 200 && r.text.includes('"ok":true'),
      r.text.slice(0, 160));

    const b = await restRead(`businesses?select=suspended_at`, token);
    check("suspended_at u vendos", Boolean(b[0]?.suspended_at), JSON.stringify(b).slice(0, 120));
  }

  console.log("\n=== 3. Pronari vazhdon të SHOHË gjithçka ===");
  for (const p of ["/dashboard", "/calendar", "/services", "/customers", "/settings"]) {
    const r = await get(p, cookie);
    check(`${p} hapet`, r.status === 200, `status=${r.status}`);
  }
  {
    const services = await restRead(`services?id=eq.${state.serviceId}&select=id`, token);
    check("shërbimi lexohet ende", Array.isArray(services) && services.length === 1,
      JSON.stringify(services).slice(0, 120));
    const html = norm(await (await get("/services", cookie)).text());
    check("paneli e thotë pse", html.includes("pezulluar"));
  }

  console.log("\n=== 4. Server action-et e aplikacionit refuzojnë ===");
  {
    const r = await callAction("/services", "createService",
      [{ name: "Shërbim i ri", durationMinutes: 30, price: 900 }], cookie);
    check("createService refuzohet", r.text.includes("pezulluar"), r.text.slice(0, 160));

    const r2 = await callAction("/services", "updateService",
      [{ id: state.serviceId, name: "Riemërtim", durationMinutes: 30, price: 100 }], cookie);
    check("updateService refuzohet", r2.text.includes("pezulluar"), r2.text.slice(0, 160));

    const r3 = await callAction("/services", "setServiceActive", [state.serviceId, false], cookie);
    check("setServiceActive refuzohet", r3.text.includes("pezulluar"), r3.text.slice(0, 160));

    const r4 = await callAction("/settings", "updateBusiness",
      [{ name: "Emër i ri", phone: "", workingHours: { monday: { start: "10:00", end: "17:00" },
        tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null } }], cookie);
    check("updateBusiness refuzohet", r4.text.includes("pezulluar"), r4.text.slice(0, 160));

    const r5 = await callAction("/settings", "addClosure", [{ date: "2027-01-05", reason: "Provë" }], cookie);
    check("addClosure refuzohet", r5.text.includes("pezulluar"), r5.text.slice(0, 160));

    const r6 = await callAction("/settings", "updateBookingRules",
      [{ bufferMinutes: 30, minNoticeMinutes: 60, bookingWindowDays: 7, breakStart: null, breakEnd: null }], cookie);
    check("updateBookingRules refuzohet", r6.text.includes("pezulluar"), r6.text.slice(0, 160));

    const r7 = await callAction("/calendar", "createManualBooking",
      [{ serviceId: state.serviceId, customerName: "Ana Hoxha", customerPhone: "",
         startTime: slotIso, note: "" }], cookie);
    check("createManualBooking refuzohet", r7.text.includes("pezulluar"), r7.text.slice(0, 160));
  }

  console.log("\n=== 5. Dhe PostgREST-i direkt refuzon njësoj ===");
  {
    const ins = await restWrite("POST", "services", token,
      { business_id: state.businessId, name: "Direkt", duration_minutes: 30, price: 100 });
    check("insert direkt i shërbimit bllokohet", ins.status >= 400,
      `status=${ins.status} ${ins.text.slice(0, 100)}`);

    const upd = await restWrite("PATCH", `services?id=eq.${state.serviceId}`, token, { price: 12345 });
    check("update direkt nuk prek asnjë rresht",
      upd.status < 400 && Array.isArray(upd.rows) && upd.rows.length === 0,
      `status=${upd.status} rows=${JSON.stringify(upd.rows).slice(0, 80)}`);

    const del = await restWrite("DELETE", `services?id=eq.${state.serviceId}`, token);
    check("delete direkt nuk prek asnjë rresht",
      del.status < 400 && Array.isArray(del.rows) && del.rows.length === 0,
      `status=${del.status} rows=${JSON.stringify(del.rows).slice(0, 80)}`);

    const biz = await restWrite("PATCH", `businesses?id=eq.${state.businessId}`, token, { name: "Hakuar" });
    check("riemërtimi direkt nuk prek asnjë rresht",
      biz.status < 400 && Array.isArray(biz.rows) && biz.rows.length === 0,
      `status=${biz.status} rows=${JSON.stringify(biz.rows).slice(0, 80)}`);

    const unsuspend = await restWrite("PATCH", `businesses?id=eq.${state.businessId}`, token,
      { suspended_at: null });
    check("nuk e heq dot vetë pezullimin",
      unsuspend.status < 400 && Array.isArray(unsuspend.rows) && unsuspend.rows.length === 0,
      `status=${unsuspend.status} rows=${JSON.stringify(unsuspend.rows).slice(0, 80)}`);

    const still = await restRead(`businesses?id=eq.${state.businessId}&select=suspended_at,name`, token);
    check("biznesi mbetet i pezulluar dhe me emrin e vjetër",
      Boolean(still[0]?.suspended_at) && still[0]?.name === "Susp Berberi",
      JSON.stringify(still).slice(0, 140));

    const svcNow = await restRead(`services?id=eq.${state.serviceId}&select=price,name,is_active`, token);
    check("shërbimi mbeti i paprekur",
      svcNow[0]?.price === 500 && svcNow[0]?.name === "Prerje flokesh" && svcNow[0]?.is_active === true,
      JSON.stringify(svcNow).slice(0, 140));

    const rpc = await rpcAs("owner_create_booking",
      { p_service_id: state.serviceId, p_customer_name: "Beni Shala", p_customer_phone: "",
        p_start_time: slotIso }, token);
    check("owner_create_booking direkt refuzon",
      rpc.body?.ok === false && String(rpc.body?.error).includes("pezulluar"),
      JSON.stringify(rpc.body).slice(0, 160));
  }

  console.log("\n=== 6. Faqja publike mbetet e shuar ===");
  {
    const r = await get(`/${state.slug}`, "");
    check("faqja publike jep 404", r.status === 404, `status=${r.status}`);
  }

  console.log("\n=== 7. Rikthimi e kthen çdo gjë ===");
  {
    const r = await callAction(`/admin/${state.ownerId}`, "setBusinessSuspended",
      [{ businessId: state.businessId, suspended: false }], adminCookie);
    check("rikthimi kaloi", r.status === 200 && r.text.includes('"ok":true'),
      r.text.slice(0, 160));

    const svc = await callAction("/services", "createService",
      [{ name: "Pas rikthimit", durationMinutes: 45, price: 700 }], cookie);
    check("createService punon sërish", svc.status === 200 && !svc.text.includes("pezulluar"),
      svc.text.slice(0, 140));

    const upd = await restWrite("PATCH", `services?id=eq.${state.serviceId}`, token, { price: 550 });
    check("update direkt punon sërish", Array.isArray(upd.rows) && upd.rows.length === 1,
      `rows=${JSON.stringify(upd.rows).slice(0, 80)}`);

    const pub = await get(`/${state.slug}`, "");
    check("faqja publike u kthye", pub.status === 200, `status=${pub.status}`);
  }

  console.log(`\nPHASE 2: ${pass} passed, ${fail} failed`);
  if (fail) { console.log("failed:\n" + failures.map((f) => " - " + f).join("\n")); process.exit(1); }
  console.log(`\nCLEANUP=${state.owner} / ${state.admin}`);
})();
