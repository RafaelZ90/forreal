/* Shared fixture checks for test/run.html (browser) and test/node/*.test.mjs (Node).
   A fixture: {text, links, promoted?, note?, expect?, expect_not?: [...], expect_host?, expect_no_link?,
   expect_tier?: "worth"|"maybe"|"skip"|"kind", expect_no_fold?, expect_fold?}. */
(function (root) {
  "use strict";
  const WORTH_AT = 65, THRESHOLD = 40;
  // Mirrors main.js with the default settings (collapse "skips", threshold 40): tests read the tier and fold the
  // reader would see. Uses the same Unspin.tierOf/autoFold the content script uses.
  function tierOf(U, v) { return U.tierOf ? U.tierOf(v, { threshold: THRESHOLD }) : (v.kind ? "kind" : v.signal >= WORTH_AT ? "worth" : v.signal < THRESHOLD ? "skip" : "maybe"); }
  function check(U, p) {
    const v = U.classify(p, { spice: "snarky" });
    const tier = tierOf(U, v);
    const folds = U.autoFold ? U.autoFold(v, tier, { collapse: "skips" }) : null;
    const why = [];
    if (p.expect && v.category !== p.expect) why.push("category " + v.category + ", want " + p.expect);
    if (p.expect_not && p.expect_not.includes(v.category)) why.push("category " + v.category + " is excluded");
    if (p.expect_host && !(v.worth && v.worth.host === p.expect_host)) why.push("link " + (v.worth ? v.worth.host : "none") + ", want " + p.expect_host);
    if (p.expect_no_link && v.worth && v.worth.href) why.push("has link " + v.worth.href);
    if (p.expect_tier && tier !== p.expect_tier) why.push("tier " + tier + " (signal " + v.signal + "), want " + p.expect_tier);
    if (p.expect_no_fold && folds) why.push("folds, must stay open");
    if (p.expect_fold && folds === false) why.push("stays open, want folded");
    const checked = !!(p.expect || p.expect_not || p.expect_host || p.expect_no_link || p.expect_tier || p.expect_no_fold || p.expect_fold);
    return { v, tier, folds, ok: checked ? why.length === 0 : null, why };
  }
  // demo-posts.js entries -> fixtures
  const fromDemo = (posts) => posts.map((p) => ({
    text: p.t, promoted: !!p.promoted, expect: p.expect, note: "demo: " + p.a,
    links: [p.link && { href: p.link.href, text: p.link.text }, p.card && { href: p.card.href, title: p.card.title }].filter(Boolean),
  }));
  root.UnspinChecks = { check, fromDemo };
})(typeof globalThis !== "undefined" ? globalThis : this);
