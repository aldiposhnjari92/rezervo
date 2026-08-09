/**
 * End-to-end test of Rezervo.al against a real production build + real Supabase.
 * Drives the app exactly like the browser does: Supabase auth cookies for page
 * loads, `Next-Action` POSTs for the server actions behind every button.
 */
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3100";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const ENV = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const SUPABASE_URL = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const REF = SUPABASE_URL.replace("https://", "").split(".")[0];
const ACTIONS = require("./actions.json");

/** RSC flight payloads escape non-ASCII (\u00eb); decode before matching. */
const norm = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail = "") {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; failures.push(label); console.log("  FAIL " + label + (detail ? "\n         " + detail : "")); }
}

// --- Supabase session -> the cookie @supabase/ssr expects ------------------
function sessionCookies(session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const CHUNK = 3180;
  if (value.length <= CHUNK) return [`${name}=${value}`];
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++) {
    parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts;
}

let COOKIE = "";
const get = (path, opts = {}) =>
  fetch(BASE + path, { redirect: "manual", headers: { cookie: COOKIE, ...(opts.headers || {}) } });

async function callAction(path, name, args) {
  const res = await fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie: COOKIE,
      "Next-Action": ACTIONS[name],
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(args),
  });
  const text = norm(await res.text());
  return { status: res.status, headers: res.headers, text };
}

const sb = (fnName, body) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

(async () => {
  const stamp = Date.now();
  const email = `rezervo.e2e.${stamp}@gmail.com`;
  const password = "TestPass123!";
  const slug = `e2e-berber-${stamp}`;

  console.log("\n=== 0. Anonymous access control ===");
  for (const p of ["/dashboard", "/calendar", "/customers", "/services", "/settings", "/setup"]) {
    const r = await get(p);
    const loc = r.headers.get("location") || "";
    check(`${p} redirects anonymous -> /login`, r.status === 307 && loc.includes("/login"),
      `status=${r.status} location=${loc}`);
  }
  {
    const r = await get("/");
    check("/ is public", r.status === 200);
  }
  console.log("\n=== 0b. Legacy /dashboard/* redirects ===");
  for (const [from, to] of [["/dashboard/services", "/services"],
                            ["/dashboard/settings", "/settings"], ["/dashboard/setup", "/setup"]]) {
    const r = await get(from);
    const loc = r.headers.get("location") || "";
    check(`${from} -> ${to}`, r.status >= 300 && r.status < 400 && loc.endsWith(to),
      `status=${r.status} location=${loc}`);
  }

  console.log("\n=== 1. Sign up ===");
  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  check("signup returns a user", Boolean(signup.user || signup.id), JSON.stringify(signup).slice(0, 200));

  const signin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

  if (!signin.access_token) {
    console.log("\n  !! could not sign in:", JSON.stringify(signin).slice(0, 300));
    console.log("  (email confirmation is probably ON — see report)");
    process.exit(2);
  }
  check("sign in returns a session", Boolean(signin.access_token));
  COOKIE = sessionCookies(signin).join("; ");
  console.log(`  user id: ${signin.user.id}`);
  console.log(`  email:   ${email}`);

  console.log("\n=== 2. New account is pushed to /setup ===");
  {
    const r = await get("/calendar");
    const loc = r.headers.get("location") || "";
    check("/calendar -> /setup when no business yet", r.status === 307 && loc.includes("/setup"),
      `status=${r.status} location=${loc}`);
    const s = await get("/setup");
    const html = norm(await s.text());
    check("/setup renders the wizard", s.status === 200 && html.includes("Të dhënat e biznesit"));
  }

  console.log("\n=== 3. Reserved slug is rejected ===");
  {
    const r = await callAction("/setup", "createBusiness", [{
      name: "Test Reserved", slug: "services", phone: "",
      workingHours: { monday: { start: "09:00", end: "18:00" }, tuesday: null, wednesday: null,
        thursday: null, friday: null, saturday: null, sunday: null },
    }]);
    check("slug 'services' rejected", r.text.includes("rezervuar"), r.text.slice(0, 200));
  }

  console.log("\n=== 4. Create business (the flow that used to error) ===");
  {
    const hours = {
      monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" },
      wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" },
      friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "14:00" },
      sunday: null,
    };
    const r = await callAction("/setup", "createBusiness", [{
      name: "E2E Berberi", slug, phone: "069 123 4567", workingHours: hours,
    }]);
    const redirect = r.headers.get("x-action-redirect") || "";
    check("createBusiness answers 303 (action redirect, no router crash)",
      r.status === 303, `status=${r.status}`);
    check("server-side redirect to /services?welcome=1", redirect.includes("/services?welcome=1"),
      `x-action-redirect=${redirect || "(none)"}`);
    check("no 'missing required error components'", !r.text.includes("missing required error"));
  }

  console.log("\n=== 5. Admin pages render ===");
  {
    const r = await get("/services?welcome=1");
    const html = norm(await r.text());
    check("/services 200", r.status === 200);
    check("welcome banner shown", html.includes("Dyqani u krijua"));
    check("empty state shown", html.includes("Shto shërbimin tënd të parë"));
    check("sidebar shows business name", html.includes("E2E Berberi"));
    check("public link shown in shell", html.includes(slug));
  }

  console.log("\n=== 6. Create services ===");
  for (const svc of [
    { name: "Prerje flokësh", durationMinutes: 30, price: 500 },
    { name: "Prerje + Mjekër", durationMinutes: 60, price: 800 },
  ]) {
    const r = await callAction("/services", "createService", [svc]);
    check(`createService "${svc.name}"`, r.status === 200 && !r.text.includes("Nuk u shtua"),
      r.text.slice(0, 160));
  }
  {
    const r = await callAction("/services", "createService", [
      { name: "X", durationMinutes: 30, price: 100 }]);
    check("service name too short is rejected", r.text.includes("Shkruaj emrin e shërbimit"));
    const r2 = await callAction("/services", "createService", [
      { name: "Gabim", durationMinutes: 3, price: 100 }]);
    check("duration below 5 min is rejected", r2.text.includes("Kohëzgjatja"));
  }
  {
    const html = norm(await (await get("/services")).text());
    check("both services listed", html.includes("Prerje flokësh") && html.includes("Prerje + Mjekër"));
    check("price formatted", html.includes("500 Lek") && !html.includes("Shto shërbimin tënd të parë"));
    check("duration formatted", html.includes("1h"));
  }

  console.log("\n=== 7. Public booking page ===");
  const pub = await sb("get_public_business", { p_slug: slug });
  check("get_public_business returns the business", pub && pub.name === "E2E Berberi");
  check("returns 2 active services", pub && pub.services.length === 2);
  check("owner_email is NOT exposed", pub && !("owner_email" in pub));
  {
    const r = await get("/" + slug);
    const html = norm(await r.text());
    check(`/${slug} renders 200`, r.status === 200);
    check("business name in header", html.includes("E2E Berberi"));
    check("services offered", html.includes("Prerje flokësh"));
    check("CTA present", html.includes("Konfirmo Rezervimin") || html.includes("Zgjidh shërbimin"));
  }

  console.log("\n=== 8. Make a real booking ===");
  // next Monday 10:00 Tirane
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  const bookingDay = d.toISOString().slice(0, 10);
  const startIso = new Date(`${bookingDay}T08:00:00Z`).toISOString(); // 10:00 Tirane (CEST)
  const svc30 = pub.services.find((s) => s.duration_minutes === 30);

  let booked = await sb("create_booking", {
    p_slug: slug, p_service_id: svc30.id, p_customer_name: "Ana Hoxha",
    p_customer_phone: "069 123 4567", p_start_time: startIso,
  });
  check("booking created", booked && booked.ok === true, JSON.stringify(booked).slice(0, 200));
  check("phone normalized in response flow", booked.ok === true);

  const dup = await sb("create_booking", {
    p_slug: slug, p_service_id: svc30.id, p_customer_name: "Beni Shala",
    p_customer_phone: "0681112223", p_start_time: startIso,
  });
  check("double booking blocked", dup.ok === false && dup.error.includes("sapo u zu"),
    JSON.stringify(dup).slice(0, 200));

  const sunday = new Date(`${bookingDay}T08:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const closed = await sb("create_booking", {
    p_slug: slug, p_service_id: svc30.id, p_customer_name: "Test Diel",
    p_customer_phone: "0691110000", p_start_time: sunday.toISOString(),
  });
  check("Sunday (closed) rejected", closed.ok === false && closed.error.includes("mbyllur"),
    JSON.stringify(closed).slice(0, 160));

  const badPhone = await sb("create_booking", {
    p_slug: slug, p_service_id: svc30.id, p_customer_name: "Test Tel",
    p_customer_phone: "042234567", p_start_time: new Date(`${bookingDay}T09:00:00Z`).toISOString(),
  });
  check("landline rejected", badPhone.ok === false && badPhone.error.includes("telefonit"));

  console.log("\n=== 9. Calendar views show the booking ===");
  for (const view of ["day", "week", "month"]) {
    const r = await get(`/calendar?view=${view}&date=${bookingDay}`);
    const html = norm(await r.text());
    check(`/calendar?view=${view} renders 200`, r.status === 200);
    check(`${view} view contains the customer`, html.includes("Ana Hoxha"));
  }
  {
    const html = norm(await (await get(`/calendar?view=day&date=${bookingDay}`)).text());
    check("day view shows 10:00 (Tirane, not 08:00 UTC)", html.includes("10:00"),
      "expected Tirane-local time");
    check("revenue stat present", html.includes("Të ardhura"));
    check("view switcher present", html.includes("Muaj") && html.includes("Javë"));
  }

  console.log("\n=== 10. Booking status actions ===");
  const bookingId = booked.booking.id;
  {
    const r = await callAction("/calendar", "updateBookingStatus", [bookingId, "completed"]);
    check("mark as completed", r.status === 200 && !r.text.includes("Nuk u ndryshua"));
    const html = norm(await (await get(`/calendar?view=day&date=${bookingDay}`)).text());
    check("status shows 'Përfunduar'", html.includes("Përfunduar"));
  }
  {
    const r = await callAction("/calendar", "updateBookingStatus", [bookingId, "no_show"]);
    check("mark as no-show", r.status === 200);
    const html = norm(await (await get(`/calendar?view=day&date=${bookingDay}`)).text());
    check("no-show reflected", html.includes("Nuk erdhi"));
  }
  {
    const r = await callAction("/calendar", "updateBookingStatus", [bookingId, "hacked"]);
    check("invalid status rejected", r.text.includes("Status i pavlefshëm"));
  }
  {
    const r = await callAction("/calendar", "updateBookingStatus", [bookingId, "cancelled"]);
    check("cancel booking", r.status === 200);
    const free = await sb("create_booking", {
      p_slug: slug, p_service_id: svc30.id, p_customer_name: "Dora Leka",
      p_customer_phone: "0691119999", p_start_time: startIso,
    });
    check("cancelling frees the slot", free.ok === true, JSON.stringify(free).slice(0, 160));
  }

  console.log("\n=== 11. Settings ===");
  {
    const r = await get("/settings");
    const html = norm(await r.text());
    check("/settings 200", r.status === 200);
    check("public link shown", html.includes(slug));
    check("working hours editor rendered", html.includes("Orari i punës"));
    check("all 7 days present", ["E hënë","E martë","E mërkurë","E enjte","E premte","E shtunë","E diel"]
      .every((d) => html.includes(d)));
  }
  {
    const r = await callAction("/settings", "updateBusiness", [{
      name: "E2E Berberi i Ri", phone: "068 111 2223",
      workingHours: { monday: { start: "10:00", end: "17:00" }, tuesday: null, wednesday: null,
        thursday: null, friday: null, saturday: null, sunday: null },
    }]);
    check("updateBusiness saved", r.status === 200 && !r.text.includes("Nuk u ruajtën"));
    const html = norm(await (await get("/settings")).text());
    check("new name persisted", html.includes("E2E Berberi i Ri"));
  }
  {
    const r = await callAction("/settings", "updateBusiness", [{
      name: "X", phone: "", workingHours: { monday: { start: "09:00", end: "18:00" } },
    }]);
    check("short name rejected", r.text.includes("shumë i shkurtër"));
    const r2 = await callAction("/settings", "updateBusiness", [{
      name: "Valid Name", phone: "042234567",
      workingHours: { monday: { start: "09:00", end: "18:00" } },
    }]);
    check("landline rejected in settings", r2.text.includes("telefonit"));
  }

  console.log("\n=== 12. 404 for unknown slug ===");
  {
    const r = await get("/nuk-ekziston-fare-" + stamp);
    check("unknown slug -> 404", r.status === 404, `status=${r.status}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP_USER_ID=" + signin.user.id);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
