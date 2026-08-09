/** Notifications, admin link, theme controls, sidebar. PHASE=1 then promote, PHASE=2. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const BASE = process.env.BASE || "http://localhost:3100";
const PHASE = process.env.PHASE || "1";
const STATE = path.join(__dirname, ".shell-state.json");
const ENV = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const URL = /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(ENV)[1].trim();
const ANON = /NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/.exec(ENV)[1].trim();
const REF = URL.replace("https://", "").split(".")[0];
const A = require("./actions.json");

const norm = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
let pass = 0, fail = 0; const failures = [];
const check = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, failures.push(l), console.log("  FAIL " + l + (d ? "\n         " + d : "")));

function cookieFor(s) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const n = `sb-${REF}-auth-token`, C = 3180;
  if (v.length <= C) return `${n}=${v}`;
  const p = []; for (let i = 0; i * C < v.length; i++) p.push(`${n}.${i}=${v.slice(i * C, (i + 1) * C)}`);
  return p.join("; ");
}
let COOKIE = "";
const get = (p) => fetch(BASE + p, { redirect: "manual", headers: { cookie: COOKIE } });
const act = (path, name, args) => fetch(BASE + path, {
  method: "POST", redirect: "manual",
  headers: { cookie: COOKIE, "Next-Action": A[name], "Content-Type": "text/plain;charset=UTF-8" },
  body: JSON.stringify(args),
}).then(async (r) => ({ status: r.status, text: norm(await r.text()) }));
const rest = (path, token) => fetch(`${URL}/rest/v1/${path}`,
  { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }).then(r => r.json());
const rpc = (fn, body, token) => fetch(`${URL}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const PW = "TestPass123!";
const signUp = (e) => fetch(`${URL}/auth/v1/signup`, { method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: e, password: PW }) }).then(r => r.json());
const signIn = (e) => fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: e, password: PW }) }).then(r => r.json());

(async () => {
  if (PHASE === "1") {
    const stamp = Date.now();
    const state = { email: `rezervo.shell.${stamp}@gmail.com`, other: `rezervo.shell.other.${stamp}@gmail.com`,
      slug: `shell-berber-${stamp}` };

    console.log("\n=== 1. Setup ===");
    await signUp(state.email); await signUp(state.other);
    const s = await signIn(state.email);
    const o = await signIn(state.other);
    check("signed in", Boolean(s.access_token));
    state.userId = s.user.id; state.otherToken = o.access_token;
    COOKIE = cookieFor(s);
    const TOKEN = s.access_token;

    const MON = { start: "09:00", end: "18:00" };
    await act("/setup", "createBusiness", [{ name: "Shell Berberi", slug: state.slug, phone: "",
      workingHours: { monday: MON, tuesday: MON, wednesday: MON, thursday: MON, friday: MON,
        saturday: MON, sunday: null } }]);
    await act("/services", "createService", [{ name: "Prerje", durationMinutes: 30, price: 500 }]);
    const pub = await rpc("get_public_business", { p_slug: state.slug });
    const svc = pub.body.services[0].id;
    state.svc = svc;

    console.log("\n=== 2. A customer booking creates a notification ===");
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
    const day = d.toISOString().slice(0, 10);
    const at = (h) => new Date(`${day}T${String(h - 2).padStart(2, "0")}:00:00Z`).toISOString();

    const booked = await rpc("create_booking", { p_slug: state.slug, p_service_id: svc,
      p_customer_name: "Ana Hoxha", p_customer_phone: "069 123 4567", p_start_time: at(10) });
    check("booking created", booked.body.ok === true, JSON.stringify(booked.body).slice(0, 120));
    state.bookingId = booked.body.booking.id;

    let notes = await rest(`notifications?select=*&order=created_at.desc`, TOKEN);
    check("notification created by the trigger", Array.isArray(notes) && notes.length === 1,
      JSON.stringify(notes).slice(0, 200));
    check("kind is booking_new", notes[0]?.kind === "booking_new");
    check("title names the customer", (notes[0]?.title || "").includes("Ana Hoxha"), notes[0]?.title);
    check("starts unread", notes[0]?.read_at === null);

    console.log("\n=== 3. Owner-added bookings do NOT notify ===");
    await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "Walk In",
      customerPhone: "", startTime: at(12) }]);
    notes = await rest(`notifications?select=id`, TOKEN);
    check("still only one notification", notes.length === 1, `n=${notes.length}`);

    console.log("\n=== 4. Status changes notify ===");
    await act("/calendar", "updateBookingStatus", [state.bookingId, "no_show"]);
    notes = await rest(`notifications?select=kind&order=created_at.desc`, TOKEN);
    check("no-show notification added", notes.some((n) => n.kind === "booking_no_show"),
      JSON.stringify(notes).slice(0, 160));
    await act("/calendar", "updateBookingStatus", [state.bookingId, "cancelled"]);
    notes = await rest(`notifications?select=kind&order=created_at.desc`, TOKEN);
    check("cancellation notification added", notes.some((n) => n.kind === "booking_cancelled"));
    check("completed status does not spam", !notes.some((n) => n.kind === "booking_completed"));

    console.log("\n=== 5. Mark as read ===");
    const unreadBefore = (await rest(`notifications?select=id&read_at=is.null`, TOKEN)).length;
    check("some unread before", unreadBefore >= 2, `n=${unreadBefore}`);
    const marked = await rpc("mark_notifications_read", {}, TOKEN);
    check("mark_notifications_read allowed", marked.status === 200, JSON.stringify(marked.body).slice(0, 120));
    const unreadAfter = (await rest(`notifications?select=id&read_at=is.null`, TOKEN)).length;
    check("nothing unread after", unreadAfter === 0, `n=${unreadAfter}`);

    console.log("\n=== 6. Another owner cannot read my notifications ===");
    const theirs = await rest(`notifications?select=id,title`, state.otherToken);
    check("other owner sees none", Array.isArray(theirs) && theirs.length === 0,
      JSON.stringify(theirs).slice(0, 160));
    const anonRead = await fetch(`${URL}/rest/v1/notifications?select=id`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }).then(r => r.json());
    check("anon sees none", Array.isArray(anonRead) && anonRead.length === 0,
      JSON.stringify(anonRead).slice(0, 160));
    const otherMark = await rpc("mark_notifications_read", {}, state.otherToken);
    check("other owner's mark-read cannot touch mine", otherMark.status >= 400 || otherMark.body === 0,
      JSON.stringify(otherMark.body).slice(0, 120));

    console.log("\n=== 7. Shell chrome ===");
    const page = await get("/dashboard");
    const html = norm(await page.text());
    check("/dashboard renders", page.status === 200, `status=${page.status}`);
    check("notification bell present", html.includes("Njoftimet"));
    check("sidebar collapse control present", html.includes("Palos menunë"));
    check("theme selector present", html.includes("E errët") && html.includes("Sistemi"));
    check("NO admin link for a non-admin", !html.includes("Paneli i platformës"));

    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    console.log(`\nPHASE 1: ${pass} passed, ${fail} failed`);
    if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
    console.log("\nPROMOTE=" + state.userId);
    process.exit(fail ? 1 : 0);
  }

  // ---------------------------------------------------------------- PHASE 2
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const s = await signIn(state.email);
  COOKIE = cookieFor(s);

  console.log("\n=== 8. Admin link is now visible (the reported bug) ===");
  const page = await get("/dashboard");
  const html = norm(await page.text());
  check("/dashboard renders", page.status === 200);
  check("sidebar admin link present", html.includes("Paneli i platformës"),
    "this is what was missing before");
  check("links to /admin", html.includes('href="/admin"'));

  const admin = await get("/admin");
  check("/admin reachable for this account", admin.status === 200, `status=${admin.status}`);
  const adminHtml = norm(await admin.text());
  check("admin page renders platform view", adminHtml.includes("Pamja e platformës"));

  console.log(`\nPHASE 2: ${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP=" + state.email);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
