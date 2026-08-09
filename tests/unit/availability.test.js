const a = require("../.build/availability.js");
const { normalizeAlbanianPhone, formatAlbanianPhone } = require("../.build/phone.js");
const { slugify, isValidSlug } = require("../.build/slug.js");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + "\n         got:  " + g + "\n         want: " + w); }
}

const HOURS = {
  monday: { start: "09:00", end: "18:00" },
  tuesday: { start: "09:00", end: "18:00" },
  wednesday: { start: "09:00", end: "18:00" },
  thursday: { start: "09:00", end: "18:00" },
  friday: { start: "09:00", end: "18:00" },
  saturday: { start: "09:00", end: "14:00" },
  sunday: null,
};

console.log("\n--- dayKeyForDate ---");
// 2026-08-08 is a Saturday, 2026-08-10 a Monday
eq("Sat", a.dayKeyForDate("2026-08-08"), "saturday");
eq("Mon", a.dayKeyForDate("2026-08-10"), "monday");
eq("Sun", a.dayKeyForDate("2026-08-09"), "sunday");

console.log("\n--- generateDaySlots: summer (CEST, UTC+2) ---");
// Monday 2026-08-10, 09:00-18:00, 30min service, nothing booked, "now" far in past
let d = a.generateDaySlots({
  date: "2026-08-10", hours: HOURS.monday, durationMinutes: 30,
  taken: [], now: new Date("2026-08-01T00:00:00Z"),
});
eq("slot count 09:00->18:00 @30min", d.slots.length, 18);
eq("first label", d.slots[0].label, "09:00");
eq("last label", d.slots[17].label, "17:30");
eq("09:00 Tirane == 07:00Z in August", d.slots[0].iso, "2026-08-10T07:00:00.000Z");
eq("all available", d.availableCount, 18);

console.log("\n--- generateDaySlots: winter (CET, UTC+1) ---");
let w = a.generateDaySlots({
  date: "2026-01-12", hours: HOURS.monday, durationMinutes: 30,
  taken: [], now: new Date("2026-01-01T00:00:00Z"),
});
eq("09:00 Tirane == 08:00Z in January", w.slots[0].iso, "2026-01-12T08:00:00.000Z");

console.log("\n--- long service truncates the tail ---");
let long = a.generateDaySlots({
  date: "2026-08-10", hours: HOURS.monday, durationMinutes: 90,
  taken: [], now: new Date("2026-08-01T00:00:00Z"),
});
eq("last 90min slot is 16:30", long.slots[long.slots.length - 1].label, "16:30");
eq("90min slot count", long.slots.length, 16);

console.log("\n--- closed day ---");
let closed = a.generateDaySlots({
  date: "2026-08-09", hours: HOURS.sunday, durationMinutes: 30,
  taken: [], now: new Date("2026-08-01T00:00:00Z"),
});
eq("sunday closed", closed.isClosed, true);
eq("sunday no slots", closed.slots.length, 0);

console.log("\n--- existing booking removes overlapping slots ---");
// Booked 10:00-11:00 Tirane (08:00-09:00Z in August)
const taken = [{ start_time: "2026-08-10T08:00:00.000Z", end_time: "2026-08-10T09:00:00.000Z" }];
let withBooking = a.generateDaySlots({
  date: "2026-08-10", hours: HOURS.monday, durationMinutes: 30,
  taken, now: new Date("2026-08-01T00:00:00Z"),
});
const unavailable = withBooking.slots.filter(s => !s.available).map(s => s.label);
eq("30min service: 10:00 and 10:30 blocked", unavailable, ["10:00", "10:30"]);

// A 60-min service must also lose 09:30 (would run 09:30-10:30, overlapping)
let withBooking60 = a.generateDaySlots({
  date: "2026-08-10", hours: HOURS.monday, durationMinutes: 60,
  taken, now: new Date("2026-08-01T00:00:00Z"),
});
eq("60min service: 09:30, 10:00, 10:30 blocked",
   withBooking60.slots.filter(s => !s.available).map(s => s.label),
   ["09:30", "10:00", "10:30"]);

console.log("\n--- past slots and lead time ---");
// "Now" is Monday 2026-08-10 11:10 Tirane == 09:10Z. Lead time 30min -> earliest 11:40.
let today = a.generateDaySlots({
  date: "2026-08-10", hours: HOURS.monday, durationMinutes: 30,
  taken: [], now: new Date("2026-08-10T09:10:00Z"),
});
const firstFree = today.slots.find(s => s.available);
eq("first bookable slot is 12:00 (11:30 is inside lead window)", firstFree.label, "12:00");
eq("11:00 not available", today.slots.find(s => s.label === "11:00").available, false);
eq("11:30 not available (lead time)", today.slots.find(s => s.label === "11:30").available, false);

console.log("\n--- buildAvailability: 7 days ---");
const week = a.buildAvailability({
  workingHours: HOURS, durationMinutes: 30, taken: [],
  days: 7, now: new Date("2026-08-10T06:00:00Z"),
});
eq("7 days returned", week.length, 7);
eq("starts today", week[0].date, "2026-08-10");
eq("ends +6", week[6].date, "2026-08-16");
eq("sunday in window is closed", week.find(x => x.date === "2026-08-16").isClosed, true);
eq("saturday 09-14 has 10 slots", week.find(x => x.date === "2026-08-15").slots.length, 10);

console.log("\n--- DST boundary: clocks go forward 2026-03-29 ---");
const dst = a.generateDaySlots({
  date: "2026-03-29", hours: { start: "09:00", end: "18:00" }, durationMinutes: 30,
  taken: [], now: new Date("2026-03-01T00:00:00Z"),
});
eq("09:00 on DST day == 07:00Z (already CEST)", dst.slots[0].iso, "2026-03-29T07:00:00.000Z");
eq("DST day still 18 slots", dst.slots.length, 18);

console.log("\n--- phone normalization ---");
eq("069 123 4567", normalizeAlbanianPhone("069 123 4567"), "+355691234567");
eq("0691234567", normalizeAlbanianPhone("0691234567"), "+355691234567");
eq("+355 69 123 4567", normalizeAlbanianPhone("+355 69 123 4567"), "+355691234567");
eq("00355691234567", normalizeAlbanianPhone("00355691234567"), "+355691234567");
eq("691234567", normalizeAlbanianPhone("691234567"), "+355691234567");
eq("068...", normalizeAlbanianPhone("0681112223"), "+355681112223");
eq("067...", normalizeAlbanianPhone("0671112223"), "+355671112223");
eq("reject landline 04...", normalizeAlbanianPhone("042234567"), null);
eq("reject 066 (not a mobile prefix)", normalizeAlbanianPhone("0661234567"), null);
eq("reject too short", normalizeAlbanianPhone("069123"), null);
eq("reject too long", normalizeAlbanianPhone("06912345678"), null);
eq("reject letters", normalizeAlbanianPhone("069abc4567"), null);
eq("display format", formatAlbanianPhone("+355691234567"), "069 123 4567");

console.log("\n--- slugify ---");
eq("Berberi Ilir", slugify("Berberi Ilir"), "berberi-ilir");
eq("albanian ë/ç", slugify("Sallon Bukurie Çelësi"), "sallon-bukurie-celesi");
eq("punctuation", slugify("  Lavazh 'Shpejt' & Mirë!! "), "lavazh-shpejt-mire");
eq("no trailing dash", slugify("Dentist ---"), "dentist");
eq("valid", isValidSlug("berberi-ilir"), true);
eq("reject uppercase", isValidSlug("Berberi"), false);
eq("reject double dash", isValidSlug("a--b"), false);
eq("reject too short", isValidSlug("ab"), false);

console.log("\n--- formatting ---");
eq("price", a.formatPrice(1200), "1.200 Lek");
eq("free", a.formatPrice(0), "Falas");
eq("duration 45", a.formatDuration(45), "45 min");
eq("duration 90", a.formatDuration(90), "1h 30min");
eq("duration 120", a.formatDuration(120), "2h");
eq("day month", a.formatDayMonth("2026-08-08"), "8 Gusht");
eq("instant -> Tirane day (00:30 Tirane = 22:30Z prev day)",
   a.formatDayMonthFromInstant("2026-08-07T22:30:00Z"), "8 Gusht");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
