const c = require("../.build/calendar.js");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + "\n         got:  " + g + "\n         want: " + w); }
}

// Reference dates: 2026-08-01 is a Saturday. 2026-08-08 Saturday. 2026-08-10 Monday.
console.log("\n--- startOfWeek (weeks start Monday) ---");
eq("Mon stays put",        c.startOfWeek("2026-08-10"), "2026-08-10");
eq("Sat -> prior Mon",     c.startOfWeek("2026-08-08"), "2026-08-03");
eq("Sun -> prior Mon",     c.startOfWeek("2026-08-09"), "2026-08-03");
eq("crosses month back",   c.startOfWeek("2026-08-01"), "2026-07-27");

console.log("\n--- month boundaries ---");
eq("startOfMonth", c.startOfMonth("2026-08-19"), "2026-08-01");
eq("endOfMonth Aug (31)", c.endOfMonth("2026-08-19"), "2026-08-31");
eq("endOfMonth Feb 2026 (28)", c.endOfMonth("2026-02-10"), "2026-02-28");
eq("endOfMonth Feb 2028 leap (29)", c.endOfMonth("2028-02-10"), "2028-02-29");
eq("addMonths +1", c.addMonths("2026-08-15", 1), "2026-09-01");
eq("addMonths -1 across year", c.addMonths("2026-01-15", -1), "2025-12-01");
eq("addMonths +5", c.addMonths("2026-08-01", 5), "2027-01-01");

console.log("\n--- weekDates ---");
eq("7 days Mon..Sun", c.weekDates("2026-08-08"),
   ["2026-08-03","2026-08-04","2026-08-05","2026-08-06","2026-08-07","2026-08-08","2026-08-09"]);

console.log("\n--- monthGrid ---");
const augGrid = c.monthGrid("2026-08-15");
eq("Aug 2026 grid length is a multiple of 7", augGrid.length % 7, 0);
eq("Aug 2026 grid = 42 cells", augGrid.length, 42);
eq("starts Mon before Aug 1", augGrid[0], "2026-07-27");
eq("ends Sun after Aug 31", augGrid[augGrid.length - 1], "2026-09-06");
eq("contains every day of August",
   augGrid.filter(d => d.startsWith("2026-08")).length, 31);

// Feb 2027: Feb 1 is a Monday, Feb 28 a Sunday -> exactly 4 rows, no filler week.
const febGrid = c.monthGrid("2027-02-10");
eq("Feb 2027 = exactly 28 cells (4 rows, no empty row)", febGrid.length, 28);
eq("Feb 2027 starts Feb 1", febGrid[0], "2027-02-01");
eq("Feb 2027 ends Feb 28", febGrid[27], "2027-02-28");

console.log("\n--- isSameMonth ---");
eq("in month",  c.isSameMonth("2026-08-31", "2026-08-01"), true);
eq("out month", c.isSameMonth("2026-09-01", "2026-08-01"), false);

console.log("\n--- rangeForView ---");
eq("day range",   c.rangeForView("day",  "2026-08-08"), { from: "2026-08-08", to: "2026-08-09" });
eq("week range",  c.rangeForView("week", "2026-08-08"), { from: "2026-08-03", to: "2026-08-10" });
eq("month range", c.rangeForView("month","2026-08-15"), { from: "2026-07-27", to: "2026-09-07" });

console.log("\n--- stepDate ---");
eq("day +1",    c.stepDate("day",   "2026-08-31", 1),  "2026-09-01");
eq("week +1",   c.stepDate("week",  "2026-08-08", 1),  "2026-08-15");
eq("week -1",   c.stepDate("week",  "2026-08-08", -1), "2026-08-01");
eq("month +1",  c.stepDate("month", "2026-08-15", 1),  "2026-09-01");
eq("month -1 across year", c.stepDate("month", "2026-01-15", -1), "2025-12-01");

console.log("\n--- headingForView ---");
eq("month heading", c.headingForView("month", "2026-08-15"), "Gusht 2026");
eq("day heading",   c.headingForView("day",   "2026-08-08"), "8 Gusht 2026");
eq("week same month",  c.headingForView("week", "2026-08-08"), "3 – 9 Gusht 2026");
eq("week across months", c.headingForView("week", "2026-08-01"), "27 Korrik – 2 Gusht 2026");

console.log("\n--- Tirane-local time extraction ---");
// 08:00Z in August = 10:00 in Tirane (UTC+2)
eq("summer offset", c.minutesFromMidnight("2026-08-10T08:00:00Z"), 10 * 60);
// 08:00Z in January = 09:00 in Tirane (UTC+1)
eq("winter offset", c.minutesFromMidnight("2026-01-12T08:00:00Z"), 9 * 60);
// 22:30Z on Aug 7 = 00:30 Tirane on Aug 8 -> belongs to Aug 8
eq("date rolls into next Tirane day", c.bookingDate({ start_time: "2026-08-07T22:30:00Z" }), "2026-08-08");

console.log("\n--- groupByDate ---");
const grouped = c.groupByDate([
  { start_time: "2026-08-10T08:00:00Z" },
  { start_time: "2026-08-10T09:00:00Z" },
  { start_time: "2026-08-11T08:00:00Z" },
]);
eq("2 distinct days", grouped.size, 2);
eq("2 bookings on Aug 10", grouped.get("2026-08-10").length, 2);

console.log("\n--- layoutDay: lane assignment ---");
const mk = (id, startZ, endZ, status = "confirmed") =>
  ({ id, status, start_time: startZ, end_time: endZ, services: null });

// Non-overlapping -> all single lane
const seq = c.layoutDay([
  mk("a", "2026-08-10T08:00:00Z", "2026-08-10T08:30:00Z"),
  mk("b", "2026-08-10T09:00:00Z", "2026-08-10T09:30:00Z"),
]);
eq("sequential -> 1 lane each", seq.map(p => [p.lane, p.lanes]), [[0,1],[0,1]]);
eq("positions in minutes", seq.map(p => [p.startMin, p.endMin]), [[600,630],[660,690]]);

// A cancelled booking overlapping a confirmed one -> 2 lanes
const overlap = c.layoutDay([
  mk("a", "2026-08-10T08:00:00Z", "2026-08-10T09:00:00Z"),
  mk("b", "2026-08-10T08:30:00Z", "2026-08-10T09:30:00Z", "cancelled"),
]);
eq("overlapping -> 2 lanes", overlap.map(p => [p.lane, p.lanes]), [[0,2],[1,2]]);

// Three-way overlap
const triple = c.layoutDay([
  mk("a", "2026-08-10T08:00:00Z", "2026-08-10T10:00:00Z"),
  mk("b", "2026-08-10T08:30:00Z", "2026-08-10T09:00:00Z", "cancelled"),
  mk("c", "2026-08-10T08:45:00Z", "2026-08-10T09:15:00Z", "cancelled"),
]);
eq("triple overlap -> 3 lanes", triple.map(p => p.lanes), [3,3,3]);
eq("distinct lanes", triple.map(p => p.lane).sort(), [0,1,2]);

// Touching (end == start) must NOT count as overlap
const touching = c.layoutDay([
  mk("a", "2026-08-10T08:00:00Z", "2026-08-10T08:30:00Z"),
  mk("b", "2026-08-10T08:30:00Z", "2026-08-10T09:00:00Z"),
]);
eq("back-to-back -> still 1 lane", touching.map(p => p.lanes), [1,1]);

console.log("\n--- visibleHourRange ---");
const HOURS = {
  monday: { start: "09:00", end: "18:00" }, tuesday: { start: "09:00", end: "18:00" },
  wednesday: { start: "09:00", end: "18:00" }, thursday: { start: "09:00", end: "18:00" },
  friday: { start: "09:00", end: "18:00" }, saturday: { start: "09:00", end: "14:00" },
  sunday: null,
};
eq("working hours only", c.visibleHourRange(HOURS, [], ["2026-08-10"]), { startMin: 540, endMin: 1080 });
eq("closed day only -> fallback", c.visibleHourRange(HOURS, [], ["2026-08-09"]), { startMin: 480, endMin: 1200 });
// A booking at 07:00 Tirane (05:00Z) must widen the window upward
eq("expands to include early booking",
   c.visibleHourRange(HOURS, [mk("x","2026-08-10T05:00:00Z","2026-08-10T05:30:00Z")], ["2026-08-10"]),
   { startMin: 420, endMin: 1080 });
eq("null working hours -> fallback", c.visibleHourRange(null, [], ["2026-08-10"]), { startMin: 480, endMin: 1200 });

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
