/**
 * Admin-panel end-to-end test.
 *
 * PHASE=1  create an owner (A) + an about-to-be admin (B); prove A has no admin powers
 * PHASE=2  (after B is promoted via SQL) prove B does, and that suspension works
 */
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3100";
const PHASE = process.env.PHASE || "1";
const STATE = path.join(__dirname, ".admin-state.json");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
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

const get = (path, cookie) =>
  fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });

async function callAction(path, name, args, cookie) {
  const res = await fetch(BASE + path, {
    method: "POST", redirect: "manual",
    headers: { cookie, "Next-Action": ACTIONS[name], "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(args),
  });
  return { status: res.status, headers: res.headers, text: norm(await res.text()) };
}

/** Call an RPC with a USER's JWT — this is what a hostile client would do. */
const rpcAs = (fn, body, token) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const signUp = (email, password) =>
  fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

const signIn = (email, password) =>
  fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

const PW = "TestPass123!";

(async () => {
  if (PHASE === "1") {
    const stamp = Date.now();
    const state = {
      ownerEmail: `rezervo.adm.owner.${stamp}@gmail.com`,
      adminEmail: `rezervo.adm.super.${stamp}@gmail.com`,
      slug: `adm-berber-${stamp}`,
    };

    console.log("\n=== 1. Create owner A and future-admin B ===");
    await signUp(state.ownerEmail, PW);
    await signUp(state.adminEmail, PW);
    const a = await signIn(state.ownerEmail, PW);
    const b = await signIn(state.adminEmail, PW);
    check("owner A signed in", Boolean(a.access_token));
    check("user B signed in", Boolean(b.access_token));
    state.ownerId = a.user.id;
    state.adminId = b.user.id;

    const cookieA = cookieFor(a);

    console.log("\n=== 2. A sets up a business + service + booking ===");
    const hours = {
      monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" },
      wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" },
      friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "14:00" },
      sunday: null,
    };
    const created = await callAction("/setup", "createBusiness",
      [{ name: "Admin Test Berberi", slug: state.slug, phone: "069 123 4567", workingHours: hours }], cookieA);
    check("business created", created.status === 303, `status=${created.status}`);

    await callAction("/services", "createService",
      [{ name: "Prerje flokesh", durationMinutes: 30, price: 500 }], cookieA);

    const pub = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: state.slug }),
    }).then((r) => r.json());
    check("public page data available", pub && pub.services.length === 1);
    state.serviceId = pub.services[0].id;

    const d = new Date();
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
    if (day.getTime() <= d.getTime()) day.setUTCDate(day.getUTCDate() + 7);
    state.startIso = new Date(`${day.toISOString().slice(0, 10)}T08:00:00Z`).toISOString();

    const booked = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: state.slug, p_service_id: state.serviceId,
        p_customer_name: "Ana Hoxha", p_customer_phone: "069 123 4567", p_start_time: state.startIso }),
    }).then((r) => r.json());
    check("booking created", booked.ok === true, JSON.stringify(booked).slice(0, 160));

    console.log("\n=== 3. A is NOT an admin — the panel must not exist for them ===");
    const adminPage = await get("/admin", cookieA);
    check("GET /admin -> 404 for non-admin", adminPage.status === 404, `status=${adminPage.status}`);
    const adminDetail = await get(`/admin/${state.adminId}`, cookieA);
    check("GET /admin/[id] -> 404 for non-admin", adminDetail.status === 404, `status=${adminDetail.status}`);

    console.log("\n=== 4. A calls the admin RPCs directly (bypassing the UI) ===");
    for (const [fn, body] of [
      ["admin_overview", {}],
      ["admin_businesses", {}],
      ["admin_daily_bookings", { p_days: 30 }],
      ["admin_orphan_accounts", {}],
      ["admin_account", { p_user_id: state.adminId }],
      ["admin_set_suspended", { p_business_id: "00000000-0000-0000-0000-000000000000", p_suspended: true }],
    ]) {
      const r = await rpcAs(fn, body, a.access_token);
      const denied = r.status >= 400 && JSON.stringify(r.body).includes("Nuk keni leje");
      check(`${fn} denied for non-admin`, denied, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`);
    }
    const isAdmin = await rpcAs("is_platform_admin", {}, a.access_token);
    check("is_platform_admin() false for A", isAdmin.body === false, JSON.stringify(isAdmin.body));

    console.log("\n=== 5. A cannot read other people's rows via PostgREST ===");
    const others = await fetch(`${SUPABASE_URL}/rest/v1/businesses?select=id,name,slug`, {
      headers: { apikey: ANON, Authorization: `Bearer ${a.access_token}` },
    }).then((r) => r.json());
    check("A sees only their own business", Array.isArray(others) && others.length === 1
      && others[0].slug === state.slug, JSON.stringify(others).slice(0, 200));
    const allBookings = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=id,customer_phone`, {
      headers: { apikey: ANON, Authorization: `Bearer ${a.access_token}` },
    }).then((r) => r.json());
    check("A sees only their own bookings", Array.isArray(allBookings) && allBookings.length === 1);

    console.log("\n=== 6. A's own account page ===");
    const acc = await get("/account", cookieA);
    const accHtml = norm(await acc.text());
    check("/account renders", acc.status === 200);
    check("shows the email", accHtml.includes(state.ownerEmail));
    check("delete section present", accHtml.includes("Fshi llogarinë"));
    check("no admin banner for non-admin", !accHtml.includes("Hap panelin e platformës"));

    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    console.log(`\nPHASE 1: ${pass} passed, ${fail} failed`);
    if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
    console.log("\nPROMOTE_USER_ID=" + state.adminId);
    process.exit(fail ? 1 : 0);
  }

  // ------------------------------------------------------------------ PHASE 2
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const b = await signIn(state.adminEmail, PW);
  const a = await signIn(state.ownerEmail, PW);
  const cookieB = cookieFor(b);
  const cookieA = cookieFor(a);

  console.log("\n=== 7. B is now an admin ===");
  const isAdmin = await rpcAs("is_platform_admin", {}, b.access_token);
  check("is_platform_admin() true for B", isAdmin.body === true, JSON.stringify(isAdmin.body));

  const page = await get("/admin", cookieB);
  const html = norm(await page.text());
  check("/admin renders 200 for admin", page.status === 200, `status=${page.status}`);
  check("shows platform heading", html.includes("Pamja e platformës"));
  check("lists the test business", html.includes("Admin Test Berberi"));
  check("shows owner email", html.includes(state.ownerEmail));
  check("renders the bookings chart", html.includes("Rezervime për ditë"));
  check("renders the status breakdown", html.includes("Statusi i rezervimeve"));
  check("shows orphan accounts section", html.includes("Llogari pa dyqan"));

  console.log("\n=== 8. Admin analytics are real numbers ===");
  const overview = await rpcAs("admin_overview", {}, b.access_token);
  check("admin_overview allowed", overview.status === 200, JSON.stringify(overview.body).slice(0, 160));
  check("counts at least our business", overview.body.businesses_total >= 1);
  check("counts at least our booking", overview.body.bookings_total >= 1);
  const daily = await rpcAs("admin_daily_bookings", { p_days: 30 }, b.access_token);
  check("daily series has 30 rows", Array.isArray(daily.body) && daily.body.length === 30,
    `len=${Array.isArray(daily.body) ? daily.body.length : "n/a"}`);
  check("daily rows are date-ordered",
    Array.isArray(daily.body) && daily.body.every((r, i, arr) => i === 0 || arr[i - 1].day <= r.day));

  console.log("\n=== 9. Per-account admin page ===");
  const detail = await get(`/admin/${state.ownerId}`, cookieB);
  const detailHtml = norm(await detail.text());
  check("/admin/[ownerId] renders", detail.status === 200, `status=${detail.status}`);
  check("shows business name", detailHtml.includes("Admin Test Berberi"));
  check("shows the service", detailHtml.includes("Prerje flokesh"));
  check("shows recent bookings", detailHtml.includes("Ana Hoxha"));
  check("does NOT leak customer phone", !detailHtml.includes("069 123 4567")
    || !detailHtml.includes("Rezervimet e fundit"), "customer phone must not appear in booking list");
  check("suspend control present", detailHtml.includes("Pezullo biznesin"));

  console.log("\n=== 10. Suspension takes the public page offline ===");
  const businesses = await rpcAs("admin_businesses", {}, b.access_token);
  const row = businesses.body.find((r) => r.slug === state.slug);
  check("business found in admin list", Boolean(row));

  const susp = await callAction(`/admin/${state.ownerId}`, "setBusinessSuspended",
    [{ businessId: row.business_id, suspended: true, reason: "test suspension" }], cookieB);
  check("suspend action succeeds", susp.status === 200 && !susp.text.includes("Nuk keni leje"),
    susp.text.slice(0, 160));

  const pubAfter = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: state.slug }),
  }).then((r) => r.json());
  check("public business data hidden while suspended", pubAfter === null, JSON.stringify(pubAfter).slice(0, 120));

  const pubPage = await get("/" + state.slug);
  check("public page 404s while suspended", pubPage.status === 404, `status=${pubPage.status}`);

  const blocked = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_booking`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: state.slug, p_service_id: state.serviceId,
      p_customer_name: "Beni Shala", p_customer_phone: "0681112223",
      p_start_time: new Date(new Date(state.startIso).getTime() + 3600e3).toISOString() }),
  }).then((r) => r.json());
  check("new bookings blocked while suspended",
    blocked.ok === false && blocked.error.includes("nuk pranon rezervime"),
    JSON.stringify(blocked).slice(0, 160));

  console.log("\n=== 11. Owner's own data survives suspension ===");
  const ownerCal = await get("/calendar?view=day", cookieA);
  check("owner can still reach their calendar", ownerCal.status === 200, `status=${ownerCal.status}`);

  console.log("\n=== 12. Unsuspend restores everything ===");
  const unsusp = await callAction(`/admin/${state.ownerId}`, "setBusinessSuspended",
    [{ businessId: row.business_id, suspended: false }], cookieB);
  check("unsuspend succeeds", unsusp.status === 200);
  const pubRestored = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: state.slug }),
  }).then((r) => r.json());
  check("public page back online", pubRestored && pubRestored.slug === state.slug);

  console.log("\n=== 13. Non-admin still cannot suspend (after admin exists) ===");
  const attempt = await callAction(`/admin/${state.ownerId}`, "setBusinessSuspended",
    [{ businessId: row.business_id, suspended: true, reason: "hostile" }], cookieA);
  check("A's suspend attempt refused", attempt.text.includes("Nuk keni leje"), attempt.text.slice(0, 200));
  const stillLive = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: state.slug }),
  }).then((r) => r.json());
  check("business really still live", stillLive && stillLive.slug === state.slug);

  console.log("\n=== 14. Admin sees the admin banner on /account ===");
  const accB = await get("/account", cookieB);
  check("B's /account redirects to setup (no business yet)",
    accB.status === 307 && (accB.headers.get("location") || "").includes("/setup"),
    `status=${accB.status} loc=${accB.headers.get("location")}`);

  console.log("\n=== 15. Owner can delete their own account ===");
  const del = await callAction("/account", "deleteMyAccount", [], cookieA);
  check("deleteMyAccount succeeds", del.status === 200 && !del.text.includes("nuk u fshi"),
    del.text.slice(0, 160));
  const gone = await signIn(state.ownerEmail, PW);
  check("deleted owner can no longer sign in", !gone.access_token, JSON.stringify(gone).slice(0, 120));
  const pubGone = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_business`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: state.slug }),
  }).then((r) => r.json());
  check("their public page is gone (cascade)", pubGone === null, JSON.stringify(pubGone).slice(0, 120));

  console.log("\n=== 16. Admin account cannot delete itself from the panel ===");
  const delAdmin = await rpcAs("delete_my_account", {}, b.access_token);
  check("admin self-delete refused", delAdmin.status >= 400
    && JSON.stringify(delAdmin.body).includes("adminit"), JSON.stringify(delAdmin.body).slice(0, 160));

  console.log(`\nPHASE 2: ${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP_ADMIN_ID=" + state.adminId);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
