/**
 * Rojtari i pamjes së njësuar.
 *
 * Nuk provon logjikë — provon që faqet vazhdojnë të dalin nga të njëjtat pjesë.
 * Arsyeja është një defekt i vërtetë: panelet ishin shkruar me `bg-background`,
 * e cila në temën e errët është MË E ERRËT se sfondi i kartelës, ndaj në të
 * errët paneli zhdukej dhe mbetej vetëm vija e rrethimit. Asnjë test i sjelljes
 * nuk e kapte, sepse faqja ngarkohej pa asnjë gabim.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "src");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail = "") {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; failures.push(label); console.log("  FAIL " + label + (detail ? "\n         " + detail : "")); }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

const files = walk(SRC).map((f) => ({ path: path.relative(SRC, f), text: fs.readFileSync(f, "utf8") }));

console.log("\n=== 1. Panelet rrinë mbi sfondin e faqes, jo poshtë tij ===");
{
  // Nënshkrimi i një paneli: rrethim + radiusi i kartelës. Sipërfaqja e tij
  // duhet të jetë `bg-card`; `bg-background` do të thoshte panel i padukshëm
  // në temën e errët.
  const offenders = [];
  for (const f of files) {
    for (const cls of f.text.match(/className=\{?"[^"]+"/g) ?? []) {
      if (cls.includes("rounded-2xl") && cls.includes("border-border") && cls.includes("bg-background")) {
        offenders.push(`${f.path}: ${cls.slice(0, 90)}`);
      }
    }
  }
  check("asnjë panel me bg-background", offenders.length === 0, offenders.join("\n         "));
}

console.log("\n=== 2. Pjesët e përbashkëta kanë vetëm një përcaktim ===");
for (const name of ["PageHeader", "EmptyState", "StatTile", "Segmented", "SearchInput"]) {
  const defs = files.filter((f) => new RegExp(`^(export )?function ${name}\\(`, "m").test(f.text));
  check(
    `${name} përcaktohet një herë`,
    defs.length === 1,
    defs.map((d) => d.path).join(", ") || "asnjë përcaktim",
  );
}

console.log("\n=== 3. Kartela është burimi i vetëm i radiusit ===");
{
  const card = files.find((f) => f.path.endsWith(path.join("ui", "card.tsx")));
  check("card.tsx u gjet", Boolean(card));
  check("Card përdor rounded-2xl", Boolean(card) && card.text.includes("rounded-2xl border border-border bg-card"));
}

console.log("\n=== 4. Çdo faqe e pronarit dhe e adminit ka një kokë ===");
{
  // Kalendari e ka titullin brenda shiritit të veglave, midis shigjetave —
  // ndaj është i vetmi që e mban vetë, me të njëjtën shkallë tipografike.
  const OWN_HEADING = ["(owner)/calendar/calendar-view.tsx"];
  const pages = files.filter(
    (f) =>
      (f.path.startsWith("app/(owner)/") || f.path.startsWith("app/admin/")) &&
      /export default (async )?function/.test(f.text) &&
      !f.path.includes("layout"),
  );
  check("u gjetën faqe për t'u provuar", pages.length >= 4, `n=${pages.length}`);
  for (const p of pages) {
    // Koka mund të jetë te faqja ose te komponenti që ajo vizaton.
    const dir = path.dirname(p.path);
    const family = files.filter((f) => path.dirname(f.path) === dir);
    const hasHeader =
      family.some((f) => f.text.includes("<PageHeader")) ||
      family.some((f) => OWN_HEADING.some((o) => f.path.endsWith(o)));
    check(`${p.path} ka kokë`, hasHeader);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("failed:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
