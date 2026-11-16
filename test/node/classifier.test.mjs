// Classifier regressions: every fixture list that test/run.html shows, with the same checks (test/checks.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadRules, readJSON, ROOT, FIXTURE_FILES } from "./load.mjs";

const ctx = loadRules();
const U = ctx.Unspin, C = ctx.UnspinChecks;
const label = (p, i) => (p.note || p.text.replace(/\s+/g, " ").slice(0, 70)) + " #" + i;

const lists = [
  ["demo LinkedIn", C.fromDemo(ctx.DEMO_LI)],
  ["demo X", C.fromDemo(ctx.DEMO_X)],
  ...FIXTURE_FILES.filter((f) => fs.existsSync(path.join(ROOT, f))).map((f) => [path.basename(f), readJSON(f)]),
];

for (const [name, list] of lists) {
  test("fixtures: " + name, async (t) => {
    for (const [i, p] of list.entries()) {
      await t.test(label(p, i), () => {
        const r = C.check(U, p);
        if (r.ok === false) assert.fail(r.why.join("; ") + " | signal " + r.v.signal + " | scores " + JSON.stringify(r.v.scores));
      });
    }
  });
}

test("fixtures are invented: no real profile links or e-mail addresses", () => {
  for (const [name, list] of lists) for (const p of list) {
    assert.doesNotMatch(p.text, /[\w.]+@[\w-]+\.(com|de|org|net)\b/, name + ": e-mail address in fixture");
    for (const l of p.links || []) assert.doesNotMatch(l.href || "", /linkedin\.com\/in\/[a-z]|x\.com\/[A-Za-z0-9_]{3,}\/status/, name + ": real profile/status link");
  }
});

test("new fixture files check every entry", () => {
  for (const f of ["worth-it.json", "junk.json", "german.json"]) {
    const file = path.join(ROOT, "test/fixtures", f);
    if (!fs.existsSync(file)) continue;
    for (const [i, p] of JSON.parse(fs.readFileSync(file, "utf8")).entries()) assert.notEqual(C.check(U, p).ok, null, f + " #" + i + " has no expectation");
  }
});
