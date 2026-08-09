/** End-to-end test of the new business features + owner dashboard. */
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3100";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
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
async function act(path, name, args) {
  const r = await fetch(BASE + path, {
    method: "POST", redirect: "manual",
    headers: { cookie: COOKIE, "Next-Action": A[name], "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(args),
  });
  return { status: r.status, text: norm(await r.text()) };
}
const rpc = (fn, body, token) => fetch(`${URL}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body || {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const PW = "TestPass123!";

(async () => {
  const stamp = Date.now();
  const email = `rezervo.feat.${stamp}@gmail.com`;
  const slug = `feat-berber-${stamp}`;

  console.log("\n=== 1. Setup ===");
  await fetch(`${URL}/auth/v1/signup`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }) }).then(r => r.json());
  const s = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PW }) }).then(r => r.json());
  check("signed in", Boolean(s.access_token));
  COOKIE = cookieFor(s);
  const TOKEN = s.access_token;

  const MON = { start: "09:00", end: "18:00" };
  await act("/setup", "createBusiness", [{ name: "Feature Berberi", slug, phone: "069 123 4567",
    workingHours: { monday: MON, tuesday: MON, wednesday: MON, thursday: MON, friday: MON,
      saturday: { start: "09:00", end: "14:00" }, sunday: null } }]);
  await act("/services", "createService", [{ name: "Prerje", durationMinutes: 30, price: 500 }]);
  const pub = await rpc("get_public_business", { p_slug: slug });
  check("business live", pub.body && pub.body.services.length === 1);
  const svc = pub.body.services[0].id;

  console.log("\n=== 2. Rules appear in the public payload ===");
  check("buffer default 0", pub.body.buffer_minutes === 0);
  check("notice default 30", pub.body.min_notice_minutes === 30);
  check("window default 7", pub.body.booking_window_days === 7);
  check("closures array present", Array.isArray(pub.body.closures));

  // next Monday 10:00 Tirane
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  const day = d.toISOString().slice(0, 10);
  const at = (h, m = 0) => new Date(`${day}T${String(h - 2).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`).toISOString();

  console.log("\n=== 3. Booking rules are enforced server-side ===");
  let r = await act("/settings", "updateBookingRules", [{ bufferMinutes: 15, minNoticeMinutes: 30,
    bookingWindowDays: 14, breakStart: "13:00", breakEnd: "14:00" }]);
  check("rules saved", r.status === 200 && !r.text.includes("nuk u ruajtën"), r.text.slice(0, 140));

  const pub2 = await rpc("get_public_business", { p_slug: slug });
  check("buffer now 15", pub2.body.buffer_minutes === 15);
  check("window now 14", pub2.body.booking_window_days === 14);
  check("break exposed", pub2.body.break_start === "13:00" && pub2.body.break_end === "14:00");

  const onBreak = await rpc("create_booking", { p_slug: slug, p_service_id: svc,
    p_customer_name: "Test Pushim", p_customer_phone: "0691110000", p_start_time: at(13) });
  check("booking during the break is refused",
    onBreak.body.ok === false && onBreak.body.error.includes("pushimin"),
    JSON.stringify(onBreak.body).slice(0, 140));

  const ok1 = await rpc("create_booking", { p_slug: slug, p_service_id: svc,
    p_customer_name: "Ana Hoxha", p_customer_phone: "069 123 4567", p_start_time: at(10) });
  check("normal booking accepted", ok1.body.ok === true, JSON.stringify(ok1.body).slice(0, 140));

  // 10:00-10:30 + 15min buffer blocks a 10:30 start
  const tooClose = await rpc("create_booking", { p_slug: slug, p_service_id: svc,
    p_customer_name: "Beni Shala", p_customer_phone: "0681112223", p_start_time: at(10, 30) });
  check("buffer blocks the adjacent slot",
    tooClose.body.ok === false, JSON.stringify(tooClose.body).slice(0, 140));

  const farOk = await rpc("create_booking", { p_slug: slug, p_service_id: svc,
    p_customer_name: "Dora Leka", p_customer_phone: "0671112223", p_start_time: at(11) });
  check("a slot beyond the buffer is accepted", farOk.body.ok === true,
    JSON.stringify(farOk.body).slice(0, 140));

  console.log("\n=== 4. Closed days ===");
  r = await act("/settings", "addClosure", [{ date: day, reason: "Festë" }]);
  check("closure added", r.status === 200 && !r.text.includes("nuk u shtua"), r.text.slice(0, 140));
  const dup = await act("/settings", "addClosure", [{ date: day }]);
  check("duplicate closure refused", dup.text.includes("tashmë e mbyllur"), dup.text.slice(0, 140));

  const pub3 = await rpc("get_public_business", { p_slug: slug });
  check("closure visible publicly", pub3.body.closures.includes(day),
    JSON.stringify(pub3.body.closures).slice(0, 120));

  const onClosed = await rpc("create_booking", { p_slug: slug, p_service_id: svc,
    p_customer_name: "Test Mbyllur", p_customer_phone: "0691114444", p_start_time: at(15) });
  check("booking on a closed day refused",
    onClosed.body.ok === false && onClosed.body.error.includes("mbyllur"),
    JSON.stringify(onClosed.body).slice(0, 140));

  console.log("\n=== 5. Manual / walk-in bookings ===");
  // owner may book on the closed day and during the break - they decide
  r = await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "Walk In",
    customerPhone: "", startTime: at(13, 30), note: "erdhi direkt" }]);
  check("walk-in with no phone accepted (overrides break + closure)",
    r.status === 200 && !r.text.includes("nuk u shtua"), r.text.slice(0, 200));

  r = await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "Telefonata",
    customerPhone: "069 555 4444", startTime: at(16) }]);
  check("phone booking accepted", r.status === 200 && !r.text.includes("nuk u shtua"), r.text.slice(0, 160));

  r = await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "Perplasje",
    customerPhone: "", startTime: at(16) }]);
  check("overlapping manual booking refused", r.text.includes("përplaset"), r.text.slice(0, 160));

  r = await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "X",
    customerPhone: "", startTime: at(17) }]);
  check("short name refused", r.text.includes("emrin e klientit"), r.text.slice(0, 160));

  r = await act("/calendar", "createManualBooking", [{ serviceId: svc, customerName: "Numer Keq",
    customerPhone: "042234567", startTime: at(17) }]);
  check("bad phone refused", r.text.includes("nuk është i saktë"), r.text.slice(0, 160));

  console.log("\n=== 6. Owner dashboard ===");
  const dash = await rpc("owner_dashboard", { p_days: 30 }, TOKEN);
  check("owner_dashboard allowed", dash.status === 200, JSON.stringify(dash.body).slice(0, 160));
  check("counts our bookings", dash.body.bookings_total >= 4, `total=${dash.body.bookings_total}`);
  check("daily series has 30 rows", Array.isArray(dash.body.daily) && dash.body.daily.length === 30);
  check("top_services populated", dash.body.top_services.length >= 1);
  check("by_hour populated", dash.body.by_hour.length >= 1);
  check("customers counted", dash.body.customers_total >= 3, `n=${dash.body.customers_total}`);

  const page = await get("/dashboard");
  const html = norm(await page.text());
  check("/dashboard renders", page.status === 200, `status=${page.status}`);
  check("shows earnings card", html.includes("Të ardhurat"));
  check("shows status breakdown", html.includes("Statusi i rezervimeve"));
  check("shows busiest days", html.includes("Ditët më të ngarkuara"));
  check("range switcher present", html.includes("7 ditë") && html.includes("90 ditë"));
  const page7 = await get("/dashboard?days=7");
  check("/dashboard?days=7 renders", page7.status === 200);

  console.log("\n=== 7. Customers ===");
  const cust = await rpc("owner_customers", {}, TOKEN);
  check("owner_customers allowed", cust.status === 200, JSON.stringify(cust.body).slice(0, 160));
  check("aggregates by customer", Array.isArray(cust.body) && cust.body.length >= 3,
    `n=${Array.isArray(cust.body) ? cust.body.length : "n/a"}`);
  const walkIn = cust.body.find((c) => c.customer_name === "Walk In");
  check("walk-in appears without a phone", walkIn && walkIn.customer_phone === null,
    JSON.stringify(walkIn).slice(0, 140));

  const cpage = await get("/customers");
  const chtml = norm(await cpage.text());
  check("/customers renders", cpage.status === 200);
  check("lists a customer", chtml.includes("Ana Hoxha"));
  check("sort filters present", chtml.includes("Më besnikët"));

  console.log("\n=== 8. Settings page shows the new controls ===");
  const spage = await get("/settings");
  const shtml = norm(await spage.text());
  check("/settings renders", spage.status === 200);
  check("booking rules section", shtml.includes("Rregullat e rezervimit"));
  check("closed days section", shtml.includes("Ditë të mbyllura"));
  check("shows the saved closure", shtml.includes("Festë"));
  check("account link present", shtml.includes("Llogaria ime"));

  console.log("\n=== 9. Removing a closure frees the day ===");
  const list = await fetch(`${URL}/rest/v1/business_closures?select=id,closed_on`, {
    headers: { apikey: ANON, Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
  check("owner can read own closures", Array.isArray(list) && list.length === 1);
  r = await act("/settings", "removeClosure", [list[0].id]);
  check("closure removed", r.status === 200 && !r.text.includes("nuk u hoq"), r.text.slice(0, 140));
  const pub4 = await rpc("get_public_business", { p_slug: slug });
  check("day is bookable again", !pub4.body.closures.includes(day),
    JSON.stringify(pub4.body.closures).slice(0, 120));

  console.log("\n=== 10. Rule validation ===");
  r = await act("/settings", "updateBookingRules", [{ bufferMinutes: 999, minNoticeMinutes: 30,
    bookingWindowDays: 7, breakStart: null, breakEnd: null }]);
  check("absurd buffer refused", r.text.includes("0–120"), r.text.slice(0, 140));
  r = await act("/settings", "updateBookingRules", [{ bufferMinutes: 0, minNoticeMinutes: 30,
    bookingWindowDays: 7, breakStart: "14:00", breakEnd: "13:00" }]);
  check("inverted break refused", r.text.includes("pas fillimit"), r.text.slice(0, 140));
  r = await act("/settings", "updateBookingRules", [{ bufferMinutes: 0, minNoticeMinutes: 30,
    bookingWindowDays: 7, breakStart: "13:00", breakEnd: null }]);
  check("half a break refused", r.text.includes("të dyja"), r.text.slice(0, 140));

  console.log("\n=== 11. Landing page ===");
  const lp = norm(await fetch(BASE + "/").then(r => r.text()));
  // strip <head> so we assert on what is actually rendered, not the OG tags
  const body = lp.slice(lp.indexOf("<body"));
  check("hero headline rendered", body.includes("Rezervo online,") && body.includes("pa telefonata"));
  check("product visual rendered", body.includes("Ana Hoxha") && body.includes("Pushim dreke"));
  check("phone mock rendered", body.includes("Konfirmo Rezervimin"));
  check("earnings panel rendered", body.includes("64.800"));
  check("testimonials section", body.includes("njerëz që punojnë me duar"));
  check("faq section", body.includes("A duhet të shkarkojnë diçka klientët?"));
  check("pricing", body.includes("1.000"));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("failed:\n - " + failures.join("\n - "));
  console.log("\nCLEANUP=" + email);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(3); });
