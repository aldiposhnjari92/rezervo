const a = require("../.build/availability.js");
let pass=0, fail=0;
function eq(l,g,w){const G=JSON.stringify(g),W=JSON.stringify(w);
  if(G===W){pass++;console.log("  ok   "+l)}else{fail++;console.log("  FAIL "+l+"\n    got:  "+G+"\n    want: "+W)}}

const MON = { start: "09:00", end: "18:00" };
const HOURS = { monday:MON,tuesday:MON,wednesday:MON,thursday:MON,friday:MON,
                saturday:{start:"09:00",end:"14:00"}, sunday:null };
const PAST = new Date("2026-08-01T00:00:00Z");

console.log("\n--- no rules: unchanged behaviour ---");
let base = a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],now:PAST});
eq("18 slots", base.slots.length, 18);
eq("all free", base.availableCount, 18);

console.log("\n--- closed day (holiday) ---");
let closed = a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
  rules:{closures:["2026-08-10"]}, now:PAST});
eq("marked closed", closed.isClosed, true);
eq("no slots", closed.slots.length, 0);
let other = a.generateDaySlots({date:"2026-08-11",hours:MON,durationMinutes:30,taken:[],
  rules:{closures:["2026-08-10"]}, now:PAST});
eq("other day unaffected", other.availableCount, 18);

console.log("\n--- lunch break 13:00-14:00 ---");
let br = a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
  rules:{breakStart:"13:00",breakEnd:"14:00"}, now:PAST});
eq("13:00 and 13:30 blocked",
   br.slots.filter(s=>!s.available).map(s=>s.label), ["13:00","13:30"]);
eq("12:30 still free", br.slots.find(s=>s.label==="12:30").available, true);
eq("14:00 free again", br.slots.find(s=>s.label==="14:00").available, true);
// a 60-min service must also lose 12:30 (would run into the break)
let br60 = a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:60,taken:[],
  rules:{breakStart:"13:00",breakEnd:"14:00"}, now:PAST});
eq("60min: 12:30 also blocked",
   br60.slots.filter(s=>!s.available).map(s=>s.label), ["12:30","13:00","13:30"]);
eq("invalid break ignored",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
     rules:{breakStart:"14:00",breakEnd:"13:00"}, now:PAST}).availableCount, 18);

console.log("\n--- buffer between appointments ---");
// booked 10:00-10:30 Tirane == 08:00-08:30Z in August
const taken=[{start_time:"2026-08-10T08:00:00.000Z",end_time:"2026-08-10T08:30:00.000Z"}];
eq("no buffer: only the booked slot is lost",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken,now:PAST})
     .slots.filter(s=>!s.available).map(s=>s.label), ["10:00"]);
eq("15min buffer: 09:30 and 10:30 also lost",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken,
     rules:{bufferMinutes:15}, now:PAST}).slots.filter(s=>!s.available).map(s=>s.label),
   ["09:30","10:00","10:30"]);
eq("30min buffer: same three, edges touch exactly",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken,
     rules:{bufferMinutes:30}, now:PAST}).slots.filter(s=>!s.available).map(s=>s.label),
   ["09:30","10:00","10:30"]);
eq("45min buffer finally takes 09:00 and 11:00 too",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken,
     rules:{bufferMinutes:45}, now:PAST}).slots.filter(s=>!s.available).map(s=>s.label),
   ["09:00","09:30","10:00","10:30","11:00"]);

console.log("\n--- minimum notice ---");
// now = Monday 2026-08-10 11:10 Tirane (09:10Z)
const NOW = new Date("2026-08-10T09:10:00Z");
eq("default 30min notice -> first free 12:00",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],now:NOW})
     .slots.find(s=>s.available).label, "12:00");
eq("no notice -> 11:30 becomes bookable",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
     rules:{minNoticeMinutes:0}, now:NOW}).slots.find(s=>s.available).label, "11:30");
eq("3h notice pushes to 14:30",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
     rules:{minNoticeMinutes:180}, now:NOW}).slots.find(s=>s.available).label, "14:30");
eq("1 day notice -> nothing left today",
   a.generateDaySlots({date:"2026-08-10",hours:MON,durationMinutes:30,taken:[],
     rules:{minNoticeMinutes:1440}, now:NOW}).availableCount, 0);

console.log("\n--- booking window ---");
eq("default window = 30 days",
   a.buildAvailability({workingHours:HOURS,durationMinutes:30,taken:[],now:PAST}).length, 30);
eq("window from rules = 14",
   a.buildAvailability({workingHours:HOURS,durationMinutes:30,taken:[],
     rules:{bookingWindowDays:14}, now:PAST}).length, 14);
eq("explicit days beats rules",
   a.buildAvailability({workingHours:HOURS,durationMinutes:30,taken:[],
     rules:{bookingWindowDays:14}, days:3, now:PAST}).length, 3);

console.log("\n--- rules combine ---");
const combo = a.buildAvailability({
  workingHours:HOURS, durationMinutes:30, taken,
  rules:{bufferMinutes:15, breakStart:"13:00", breakEnd:"14:00",
         closures:["2026-08-12"], bookingWindowDays:5, minNoticeMinutes:0},
  now:new Date("2026-08-10T00:00:00Z")});
eq("5 days returned", combo.length, 5);
eq("closure inside window is closed", combo.find(d=>d.date==="2026-08-12").isClosed, true);
const mon = combo.find(d=>d.date==="2026-08-10");
eq("window starts today", combo[0].date, "2026-08-10");
eq("monday loses buffer + break slots",
   mon.slots.filter(s=>!s.available).map(s=>s.label),
   ["09:30","10:00","10:30","13:00","13:30"]);
eq("a normal day only loses the break",
   combo.find(d=>d.date==="2026-08-11").slots.filter(s=>!s.available).map(s=>s.label),
   ["13:00","13:30"]);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
