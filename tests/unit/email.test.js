/** Përmbajtja e email-it të pezullimit — me arsye dhe pa të. */
const { suspensionEmail } = require("../.build/email-templates.js");

let pass = 0, fail = 0;
const eq = (l, c, d = "") => c
  ? (pass++, console.log("  ok   " + l))
  : (fail++, console.log("  FAIL " + l + (d ? "\n         " + d : "")));

console.log("\n--- me arsye nga admini ---");
const withReason = suspensionEmail({ businessName: "Berberi Ilir", reason: "spam rezervimesh" });
eq("subjekti përmban emrin", withReason.subject.includes("Berberi Ilir"), withReason.subject);
eq("subjekti thotë pezulluar", withReason.subject.includes("pezulluar"));
eq("HTML përmban arsyen", withReason.html.includes("spam rezervimesh"));
eq("teksti përmban arsyen", withReason.text.includes("spam rezervimesh"));
eq("HTML nuk përdor tekstin e përgjithshëm", !withReason.html.includes("gjatë një kontrolli"));
eq("thotë që të dhënat mbeten", withReason.text.includes("nuk janë prekur"));

console.log("\n--- pa arsye ---");
const generic = suspensionEmail({ businessName: "Sallon Bukurie" });
eq("subjekti përmban emrin", generic.subject.includes("Sallon Bukurie"));
eq("bie te mesazhi i përgjithshëm", generic.html.includes("gjatë një kontrolli"));
eq("teksti i përgjithshëm gjithashtu", generic.text.includes("gjatë një kontrolli"));
eq("nuk lë bllok arsyeje bosh", !generic.html.includes("Arsyeja e dhënë"));

console.log("\n--- arsye bosh trajtohet si mungesë ---");
for (const [label, reason] of [["null", null], ["bosh", ""], ["hapësira", "   "]]) {
  const r = suspensionEmail({ businessName: "Test", reason });
  eq(`arsye ${label} -> mesazh i përgjithshëm`, r.html.includes("gjatë një kontrolli"));
}

console.log("\n--- HTML injection nga arsyeja ---");
const evil = suspensionEmail({
  businessName: '<img src=x onerror="alert(1)">',
  reason: '</td></tr></table><script>alert("xss")</script>',
});
eq("emri i biznesit ikëhet", !evil.html.includes("<img src=x"), "emri kaloi i papërpunuar");
eq("arsyeja ikëhet", !evil.html.includes("<script>"), "script-i kaloi i papërpunuar");
eq("entitetet janë aty", evil.html.includes("&lt;script&gt;"));

console.log("\n--- të dyja format ekzistojnë ---");
eq("ka HTML", withReason.html.startsWith("<!doctype html>"));
eq("ka tekst të thjeshtë", withReason.text.length > 100 && !withReason.text.includes("<"));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
