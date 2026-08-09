/**
 * Testet e sigurisë — të shkruara si sulme, jo si rrjedha normale.
 *
 * Çelësi `anon` është PUBLIK: gjendet në çdo bundle të shfletuesit. Ndaj çdo
 * gjë këtu supozon një sulmues që e ka atë çelës, një llogari të tijën, dhe që
 * flet direkt me PostgREST — pa kaluar fare nga aplikacioni.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const ENV = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const BASE = process.env.BASE || "http://localhost:3100";
const A = require("./actions.json");
const REF = SUPABASE_URL.replace("https://", "").split(".")[0];

let pass = 0, fail = 0;
const failures = [];
const check = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, failures.push(l), console.log("  FAIL " + l + (d ? "\n         " + d : "")));

const norm = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function cookieFor(session) {
  const v = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const n = `sb-${REF}-auth-token`, C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  return Array.from({ length: Math.ceil(v.length / C) },
    (_, i) => `${n}.${i}=${v.slice(i * C, (i + 1) * C)}`).join("; ");
}

const PW = "TestPass123!";
const signUp = (email) => fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: PW }) }).then((r) => r.json());
const signIn = (email) => fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: PW }) }).then((r) => r.json());

/** PostgREST me një token të caktuar (ose me anon-in e zhveshur). */
const rest = (query, token, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`,
      "Content-Type": "application/json", ...(init.headers || {}) },
  });
const rpc = (fn, body, token) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}) });

(async () => {
  const stamp = Date.now();
  const victimEmail = `rezervo.sec.victim.${stamp}@gmail.com`;
  const attackerEmail = `rezervo.sec.attacker.${stamp}@gmail.com`;
  const slug = `sec-victim-${stamp}`;

  console.log("\n=== 0. Two accounts: a victim with a shop, and an attacker ===");
  await signUp(victimEmail); await signUp(attackerEmail);
  const victim = await signIn(victimEmail);
  const attacker = await signIn(attackerEmail);
  check("both signed in", Boolean(victim.access_token && attacker.access_token));

  const vCookie = cookieFor(victim);
  const aCookie = cookieFor(attacker);
  const act = (p, name, args, cookie) => fetch(BASE + p, { method: "POST", redirect: "manual",
    headers: { cookie, "Next-Action": A[name], "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(args) }).then(async (r) => ({ status: r.status, text: norm(await r.text()) }));

  const MON = { start: "09:00", end: "18:00" };
  await act("/setup", "createBusiness", [{ name: "Victim Shop", slug, phone: "069 111 2233",
    workingHours: { monday: MON, tuesday: MON, wednesday: MON, thursday: MON, friday: MON,
      saturday: MON, sunday: null } }], vCookie);
  await act("/services", "createService",
    [{ name: "Prerje", durationMinutes: 30, price: 500 }], vCookie);

  const pub = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
  const businessId = pub.id;
  const serviceId = pub.services[0].id;

  const day = (() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const at = (h, m = 0) =>
    new Date(`${day}T${String(h - 2).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).toISOString();

  const booked = await rpc("create_booking", { p_slug: slug, p_service_id: serviceId,
    p_customer_name: "Ana Hoxha", p_customer_phone: "068 777 8899",
    p_start_time: at(10) }).then((r) => r.json());
  check("victim has a booking to steal", booked.ok === true, JSON.stringify(booked).slice(0, 140));
  const bookingId = booked.booking.id;

  // =======================================================================
  console.log("\n=== 1. Anonymous cannot read ANY table (grants revoked) ===");
  for (const table of ["businesses", "services", "bookings", "notifications",
                       "business_closures", "platform_admins", "rate_limits"]) {
    const res = await rest(`${table}?select=*`, null);
    const body = await res.text();
    // 401/403 = grant revoked. An empty array would mean RLS alone is holding.
    check(`anon blocked on ${table}`, res.status === 401 || res.status === 403 || body === "[]",
      `status=${res.status} body=${body.slice(0, 90)}`);
    if (res.ok && body !== "[]") console.log("         !! LEAK: " + body.slice(0, 200));
  }

  console.log("\n=== 2. Anonymous cannot write ===");
  {
    const res = await rest("bookings", null, { method: "POST",
      body: JSON.stringify({ business_id: businessId, service_id: serviceId,
        customer_name: "Hacker", customer_phone: "+355690000000",
        start_time: at(15), end_time: at(16) }) });
    check("anon insert into bookings refused", !res.ok, `status=${res.status}`);
  }

  // =======================================================================
  console.log("\n=== 3. A signed-in stranger cannot reach the victim's data ===");
  {
    const rows = await rest(`businesses?select=id,name,slug,owner_email`, attacker.access_token).then((r) => r.json());
    check("sees no businesses at all", Array.isArray(rows) && rows.length === 0,
      JSON.stringify(rows).slice(0, 160));

    const bookings = await rest(`bookings?select=id,customer_name,customer_phone`, attacker.access_token).then((r) => r.json());
    check("sees no bookings, no customer phones", Array.isArray(bookings) && bookings.length === 0,
      JSON.stringify(bookings).slice(0, 160));

    const notes = await rest(`notifications?select=id,title`, attacker.access_token).then((r) => r.json());
    check("sees no notifications", Array.isArray(notes) && notes.length === 0);
  }

  console.log("\n=== 4. IDOR: guessing the victim's row ids changes nothing ===");
  {
    // The attacker knows both ids from the public page + a booking they made.
    const r1 = await rest(`services?id=eq.${serviceId}`, attacker.access_token, {
      method: "PATCH", body: JSON.stringify({ price: 1 }) });
    const after = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
    check("cannot repriced someone else's service",
      after.services[0].price === 500, `price is now ${after.services[0].price} (status ${r1.status})`);

    const r2 = await rest(`bookings?id=eq.${bookingId}`, attacker.access_token, {
      method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    const still = await rest(`bookings?select=status&id=eq.${bookingId}`, victim.access_token).then((r) => r.json());
    check("cannot cancel someone else's booking",
      still[0]?.status === "confirmed", `status=${still[0]?.status} (http ${r2.status})`);

    const r3 = await rest(`services?id=eq.${serviceId}`, attacker.access_token, { method: "DELETE" });
    const alive = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
    check("cannot delete someone else's service",
      alive.services.length === 1, `services left: ${alive.services.length} (http ${r3.status})`);

    const r4 = await rest(`businesses?id=eq.${businessId}`, attacker.access_token, {
      method: "PATCH", body: JSON.stringify({ name: "Pwned" }) });
    const name = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
    check("cannot rename someone else's business",
      name.name === "Victim Shop", `name=${name.name} (http ${r4.status})`);
  }

  console.log("\n=== 5. IDOR through the app's own server actions ===");
  {
    const r = await act("/services", "updateService",
      [{ id: serviceId, name: "Stolen", durationMinutes: 30, price: 1 }], aCookie);
    const after = await rpc("get_public_business", { p_slug: slug }).then((x) => x.json());
    check("updateService cannot touch another owner's service",
      after.services[0].name === "Prerje" && after.services[0].price === 500,
      JSON.stringify(after.services[0]));

    const r2 = await act("/calendar", "updateBookingStatus", [bookingId, "cancelled"], aCookie);
    const still = await rest(`bookings?select=status&id=eq.${bookingId}`, victim.access_token).then((x) => x.json());
    check("updateBookingStatus cannot touch another owner's booking",
      still[0]?.status === "confirmed", `status=${still[0]?.status}`);

    await act("/calendar", "createManualBooking",
      [{ serviceId, customerName: "Injected", customerPhone: "", startTime: at(11) }], aCookie);
    // Assert on the OUTCOME, not the wording: nothing must land in the calendar.
    const victimBookings = await rest(
      `bookings?select=customer_name&business_id=eq.${businessId}`, victim.access_token).then((x) => x.json());
    check("cannot inject a booking into another owner's calendar",
      Array.isArray(victimBookings) && !victimBookings.some((b) => b.customer_name === "Injected"),
      JSON.stringify(victimBookings).slice(0, 160));
  }

  // =======================================================================
  console.log("\n=== 6. Privilege escalation attempts ===");
  {
    const res = await rest("platform_admins", attacker.access_token, { method: "POST",
      body: JSON.stringify({ user_id: attacker.user.id, note: "self-promotion" }) });
    check("cannot insert self into platform_admins", !res.ok, `status=${res.status}`);

    const isAdmin = await rpc("is_platform_admin", {}, attacker.access_token).then((r) => r.json());
    check("is_platform_admin() is false for them", isAdmin === false, JSON.stringify(isAdmin));

    for (const fn of ["admin_overview", "admin_businesses", "admin_orphan_accounts"]) {
      const r = await rpc(fn, {}, attacker.access_token);
      const body = await r.text();
      check(`${fn} denied`, !r.ok, `status=${r.status} ${body.slice(0, 80)}`);
    }

    const susp = await rpc("admin_set_suspended",
      { p_business_id: businessId, p_suspended: true, p_reason: "hostile" }, attacker.access_token);
    const live = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
    check("cannot suspend someone else's business", live !== null, `http ${susp.status}`);
  }

  console.log("\n=== 7. Internal functions are not public endpoints ===");
  for (const fn of ["check_rate_limit", "prune_rate_limits", "notify_on_booking",
                    "notify_on_suspension", "my_business_id"]) {
    const anonRes = await rpc(fn, {}, null);
    const authRes = await rpc(fn, {}, attacker.access_token);
    const publicOk = fn === "my_business_id"; // owner helper: signed-in use is fine
    check(`${fn} not callable by anon`, !anonRes.ok, `status=${anonRes.status}`);
    if (!publicOk) {
      check(`${fn} not callable by a signed-in user`, !authRes.ok, `status=${authRes.status}`);
    }
  }

  // =======================================================================
  console.log("\n=== 8. Public booking is rate limited ===");
  {
    // Same phone, deliberately invalid times so nothing is actually booked.
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const r = await rpc("create_booking", { p_slug: slug, p_service_id: serviceId,
        p_customer_name: "Flood Bot", p_customer_phone: "069 555 0000",
        p_start_time: at(3) }).then((x) => x.json());
      if (r.error && r.error.includes("Shumë përpjekje")) { limited = true; break; }
    }
    check("a phone hammering the endpoint gets throttled", limited,
      "14 attempts went through without a rate limit");
  }

  // =======================================================================
  console.log("\n=== 9. Security headers ===");
  {
    const res = await fetch(BASE + "/", { redirect: "manual" });
    const h = (k) => res.headers.get(k) || "";
    check("Content-Security-Policy set", h("content-security-policy").length > 0);
    check("CSP uses a nonce, not unsafe-inline for scripts",
      /script-src[^;]*'nonce-/.test(h("content-security-policy"))
      && !/script-src[^;]*'unsafe-inline'/.test(h("content-security-policy")),
      h("content-security-policy").slice(0, 200));
    check("CSP forbids framing", h("content-security-policy").includes("frame-ancestors 'none'"));
    check("X-Frame-Options DENY", h("x-frame-options") === "DENY");
    check("X-Content-Type-Options nosniff", h("x-content-type-options") === "nosniff");
    check("Referrer-Policy set", h("referrer-policy").length > 0);
    check("Permissions-Policy set", h("permissions-policy").includes("geolocation=()"));

    const authed = await fetch(BASE + "/dashboard", { headers: { cookie: vCookie }, redirect: "manual" });
    check("headers present on authenticated pages too",
      (authed.headers.get("content-security-policy") || "").length > 0);
  }

  console.log("\n=== 10. Open redirect ===");
  {
    for (const evil of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      const res = await fetch(`${BASE}/auth/callback?next=${encodeURIComponent(evil)}`,
        { redirect: "manual" });
      const loc = res.headers.get("location") || "";
      check(`callback refuses next=${evil}`, !loc.includes("evil.com"), `location=${loc}`);
    }
  }

  console.log("\n=== 11. Customer phone numbers never reach the public API ===");
  {
    const taken = await rpc("get_taken_slots",
      { p_business_id: businessId, p_from: new Date().toISOString(),
        p_to: new Date(Date.now() + 14 * 864e5).toISOString() }).then((r) => r.json());
    const asText = JSON.stringify(taken);
    check("get_taken_slots exposes only times",
      !asText.includes("068") && !asText.includes("Ana") && Array.isArray(taken),
      asText.slice(0, 160));

    const business = await rpc("get_public_business", { p_slug: slug }).then((r) => r.json());
    check("get_public_business hides owner_email", !("owner_email" in business));
    check("get_public_business hides owner_id", !("owner_id" in business));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP=" + victimEmail + " / " + attackerEmail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
