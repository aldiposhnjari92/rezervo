/**
 * Nxjerr ID-të e Server Action-eve nga një build i Next-it.
 *
 * Testet end-to-end e drejtojnë aplikacionin si shfletuesi: një POST me header-in
 * `Next-Action: <id>`. Ato ID gjenerohen gjatë build-it dhe ndryshojnë sa herë
 * ndryshon kodi, ndaj duhen lexuar nga output-i, jo të shkruhen me dorë.
 *
 * Kujdes: minifikuesi i heq thonjëzat kur ID-ja nis me shkronjë, ndaj rregulli
 * duhet t'i pranojë të dyja format — përndryshe një veprim humbet në heshtje
 * dhe testi dërgon `Next-Action: undefined`.
 *
 *   node tests/e2e/extract-actions.js [dist-dir]
 */
const fs = require("fs");
const path = require("path");

const dist = process.argv[2] || ".next-test";
const serverDir = path.join(process.cwd(), dist, "server");

if (!fs.existsSync(serverDir)) {
  console.error(`Nuk u gjet "${serverDir}". Ndërto fillimisht:`);
  console.error(`  NEXT_DIST_DIR=${dist} npx next build`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full.endsWith(".js")) files.push(full);
  }
})(serverDir);

const PATTERN =
  /["']?([a-f0-9]{40})["']?:\(\)=>[\s\S]{0,400}?\.then\(([a-zA-Z0-9_$]+)=>\2\.([A-Za-z0-9_]+)\)/g;

const actions = {};
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(PATTERN)) {
    if (!actions[match[3]]) actions[match[3]] = match[1];
  }
}

const out = path.join(__dirname, "actions.json");
fs.writeFileSync(out, JSON.stringify(actions, null, 2));

const names = Object.keys(actions).sort();
console.log(`${names.length} veprime -> ${path.relative(process.cwd(), out)}`);
console.log("  " + names.join(", "));

// Nëse mungon ndonjë veprim, testet do të dështonin në mënyrë të pakuptueshme.
const EXPECTED = [
  "createBusiness",
  "updateBusiness",
  "createService",
  "updateService",
  "setServiceActive",
  "deleteService",
  "updateBookingStatus",
  "submitBooking",
  "setBusinessSuspended",
  "deleteMyAccount",
  "createManualBooking",
  "updateBookingRules",
  "addClosure",
  "removeClosure",
];
const missing = EXPECTED.filter((name) => !actions[name]);
if (missing.length) {
  console.error("\nMUNGOJNË: " + missing.join(", "));
  process.exit(1);
}
