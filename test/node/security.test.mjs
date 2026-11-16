// Security invariants from the 0.2.5 review (CLAUDE.md), as tests.
import test from "node:test";
import assert from "node:assert/strict";
import { loadRules, read } from "./load.mjs";

const U = loadRules().Unspin;

test("safeUrl keeps only http(s)", () => {
  for (const bad of ["javascript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "JAVASCRIPT:x", "data:text/html,<b>", "vbscript:x",
    "file:///etc/passwd", "chrome-extension://abc/x", "blob:https://x.com/1", "//evil.example", "", null, undefined, 42])
    assert.equal(U.safeUrl(bad), "", String(bad));
  assert.equal(U.safeUrl("https://doi.org/10.1/x"), "https://doi.org/10.1/x");
  assert.equal(U.safeUrl("  http://example.org/a b"), "http://example.org/a%20b");
});

test("bestLink never returns a non-http link, even inside a LinkedIn redirect", () => {
  const links = [
    { href: "https://www.linkedin.com/redir/redirect?url=javascript%3Aalert(1)", text: "doi.org/10.1/x" },
    { href: "https://www.linkedin.com/safety/go?url=data%3Atext%2Fhtml%2C%3Cscript%3E", text: "arxiv.org" },
    { href: "javascript:alert(1)//github.com", text: "github.com/x" },
  ];
  assert.equal(U.bestLink(links), null);
  const ok = U.bestLink([{ href: "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Farxiv.org%2Fabs%2F2601.00001", text: "arxiv" }]);
  assert.equal(ok.href, "https://arxiv.org/abs/2601.00001");
});

test("redirect unwrapping is limited to linkedin.com", () => {
  const l = U.bestLink([{ href: "https://evil-linkedin.com/redir/redirect?url=https%3A%2F%2Farxiv.org%2Fabs%2F1", text: "x" }]);
  assert.equal(l.host, "evil-linkedin.com");
});

test("the classifier's verdict link is always one of the post's own links", () => {
  const post = { text: "Our paper is out today with open data and code, published in Nature after peer review. We find a large effect, n = 4000.", links: [{ href: "https://doi.org/10.1/abc", text: "doi" }] };
  const v = U.classify(post, {});
  assert.equal(v.worth.href, "https://doi.org/10.1/abc");
  const none = U.classify(Object.assign({}, post, { links: [] }), {});
  assert.equal(none.worth, null);
});

const base = () => U.classify({ text: "Our new preprint on arXiv: we study 120 open-source projects and find that code review latency predicts contributor churn. Data and code are open.", links: [{ href: "https://arxiv.org/abs/2601.1", text: "arxiv.org/abs/2601.1" }] }, {});
const ad = () => U.classify({ text: "Stop wasting hours on reports. GrowthStack builds dashboards for you. Start your free trial today and save twelve hours a week.", links: [], promoted: true }, {});

test("model output may not turn an ad into a non-ad", () => {
  const a = ad();
  for (const category of ["paper", "insight", "personal", "plain"]) {
    const v = U.mergeAI(a, { category, signal: 99, roast: "r", gist: "g" }, {});
    assert.equal(v.category, "ad");
    assert.equal(v.signal, a.signal);
    assert.equal(U.autoFold(v, U.tierOf(v, {}), {}), true);
  }
});

test("model output may not turn a post into an ad (which would always fold)", () => {
  const b = base();
  const v = U.mergeAI(b, { category: "ad", signal: 0 }, {});
  assert.notEqual(v.category, "ad");
});

test("model output moves the score by at most 25", () => {
  const b = base();
  for (const signal of [-1e9, -1, 0, 3, 50, 100, 1e9, NaN, Infinity, "99", null]) {
    const v = U.mergeAI(b, { category: "take", signal }, {});
    assert.ok(Math.abs(v.signal - b.signal) <= 25, String(signal) + " -> " + v.signal);
    assert.ok(Number.isFinite(v.signal));
  }
});

test("model output cannot supply its own link, only re-title the rules' link", () => {
  const b = base();
  const v = U.mergeAI(b, { category: "release", signal: 80, worth: { href: "https://evil.example/x", title: "Click", host: "evil.example" } }, {});
  assert.equal(v.worth.href, b.worth.href);
  const t = U.mergeAI(b, { category: "paper", signal: 80, worth: { href: b.worth.href, title: "Code review latency and churn" } }, {});
  assert.equal(t.worth.title, "Code review latency and churn");
  const none = U.classify({ text: "A normal post about my weekend in the garden, the tomatoes are finally ripe and the shed is fixed.", links: [] }, {});
  assert.equal(U.mergeAI(none, { category: "paper", signal: 90, worth: { href: "https://evil.example", title: "x" } }, {}).worth, null);
});

test("model output cannot overrule the reader's correction or a personal post", () => {
  const b = U.relabel(base(), "take", "snarky");
  assert.equal(U.mergeAI(b, { category: "bait", signal: 0 }, { corrected: true }).category, "take");
  const p = U.classify({ text: "Last week I was laid off after six years, together with forty colleagues. If you hear of a data role, I would be grateful for a pointer.", links: [] }, {});
  assert.equal(p.category, "personal");
  const v = U.mergeAI(p, { category: "bait", signal: 0, roast: "lol" }, {});
  assert.equal(v.kind, true);
  assert.equal(U.autoFold(v, U.tierOf(v, {}), { collapse: "maybe" }), false);
});

test("model strings are clipped and non-strings ignored", () => {
  const b = base();
  const v = U.mergeAI(b, { roast: "x".repeat(5000), gist: { toString: () => "boom" } }, {});
  assert.equal(v.roast.length, 140);
  assert.equal(v.gist, b.gist);
  assert.equal(U.mergeAI(b, null, {}), b);
  assert.equal(U.mergeAI(b, { category: "__proto__" }, {}).category, b.category);
  assert.equal(U.mergeAI(b, { category: "constructor" }, {}).category, b.category);
});

test("fold policy: never a worth link, never personal, ads always", () => {
  const v = (o) => Object.assign({ category: "bait", signal: 5, worth: null, kind: false }, o);
  assert.equal(U.autoFold(v({}), "skip", {}), true);
  assert.equal(U.autoFold(v({ worth: { href: "https://doi.org/1" } }), "skip", {}), false);
  assert.equal(U.autoFold(v({ category: "personal", kind: true }), "kind", { collapse: "maybe" }), false);
  assert.equal(U.autoFold(v({ category: "ad", signal: 90 }), "maybe", {}), true);
  assert.equal(U.autoFold(v({ category: "ad" }), "skip", { collapse: "never" }), false);
  assert.equal(U.autoFold(v({ category: "brag", signal: 30 }), "skip", {}), false); // other skips stay open
  assert.equal(U.autoFold(v({ category: "brag", signal: 10 }), "skip", {}), true);
});

test("content scripts render only with textContent (no innerHTML, insertAdjacentHTML, eval)", () => {
  for (const f of ["src/content/classifier.js", "src/content/policy.js", "src/content/sites.js", "src/content/overlay.js", "src/content/main.js", "src/background.js", "src/ai-chrome.js", "src/popup/popup.js", "src/options/options.js"]) {
    const s = read(f);
    const m = s.match(/\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(|setTimeout\(\s*["'`]/);
    assert.ok(!m, f + ": " + (m && m[0]));
  }
});

test("content scripts never touch storage.local directly", () => {
  for (const f of ["src/content/classifier.js", "src/content/policy.js", "src/content/sites.js", "src/content/overlay.js", "src/content/main.js"])
    assert.ok(!/storage\.local\.|storage\[["']local/.test(read(f)), f);
});
