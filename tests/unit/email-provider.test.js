/**
 * Zgjedhja e provider-it. E rëndësishme sepse një gabim këtu do të thoshte ose
 * email-e që s'dërgohen kurrë, ose një çelës që dërgohet te provider-i i gabuar.
 *
 * Moduli lexohet çdo herë nga e para, sepse FROM lexohet në kohën e importit.
 */
const path = require("path");

let pass = 0, fail = 0;
const eq = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, console.log("  FAIL " + l + (d ? "\n         " + d : "")));

const MODULE = path.join(__dirname, "..", ".build", "email-provider.js");

function withEnv(env, fn) {
  const saved = { ...process.env };
  for (const k of ["RESEND_API_KEY", "BREVO_API_KEY", "EMAIL_PROVIDER", "EMAIL_FROM"]) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve(MODULE)];
  try {
    return fn(require(MODULE));
  } finally {
    process.env = saved;
  }
}

console.log("\n--- zbulimi automatik ---");
withEnv({}, (m) => eq("pa çelës -> none", m.activeProvider() === "none"));
withEnv({ RESEND_API_KEY: "re_x" }, (m) => eq("vetëm Resend -> resend", m.activeProvider() === "resend"));
withEnv({ BREVO_API_KEY: "xkeysib-x" }, (m) => eq("vetëm Brevo -> brevo", m.activeProvider() === "brevo"));
withEnv({ RESEND_API_KEY: "re_x", BREVO_API_KEY: "xkeysib-x" },
  (m) => eq("të dy -> resend ka përparësi", m.activeProvider() === "resend"));

console.log("\n--- EMAIL_PROVIDER e detyron zgjedhjen ---");
withEnv({ RESEND_API_KEY: "re_x", BREVO_API_KEY: "xkeysib-x", EMAIL_PROVIDER: "brevo" },
  (m) => eq("detyro brevo", m.activeProvider() === "brevo"));
withEnv({ RESEND_API_KEY: "re_x", EMAIL_PROVIDER: "none" },
  (m) => eq("detyro none edhe me çelës", m.activeProvider() === "none"));
withEnv({ RESEND_API_KEY: "re_x", EMAIL_PROVIDER: "BREVO" },
  (m) => eq("pa çelës Brevo -> none (jo rënie e heshtur te Resend)", m.activeProvider() === "none"));
withEnv({ RESEND_API_KEY: "re_x", EMAIL_PROVIDER: "  Resend  " },
  (m) => eq("toleron hapësira dhe shkronja të mëdha", m.activeProvider() === "resend"));
withEnv({ RESEND_API_KEY: "re_x", EMAIL_PROVIDER: "mailgun" },
  (m) => eq("provider i panjohur injorohet", m.activeProvider() === "resend"));

console.log("\n--- parsimi i EMAIL_FROM ---");
withEnv({ BREVO_API_KEY: "x", EMAIL_FROM: "Rezervo.al <njoftime@rezervo.al>" }, (m) => {
  const p = m.parseFrom("Rezervo.al <njoftime@rezervo.al>");
  eq("emri nxirret", p.name === "Rezervo.al", JSON.stringify(p));
  eq("adresa nxirret", p.address === "njoftime@rezervo.al", JSON.stringify(p));
});
withEnv({ BREVO_API_KEY: "x" }, (m) => {
  const p = m.parseFrom("njoftime@rezervo.al");
  eq("adresa e zhveshur", p.address === "njoftime@rezervo.al" && p.name === undefined,
    JSON.stringify(p));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
