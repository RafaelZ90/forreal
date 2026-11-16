/*
 * ForReal – what the reader sees for a verdict: the tier (Worth it / Maybe / Skip / Personal), whether the post folds
 * on its own, and how an AI answer may change the rules' verdict. Pure functions, shared by main.js and the tests.
 */
(function (root) {
  "use strict";
  const WORTH_AT = 65; // signal from which a post is "Worth it"

  function tierOf(v, cfg) {
    if (v.kind) return "kind";
    if (v.signal >= WORTH_AT) return "worth";
    if (v.signal < ((cfg && cfg.threshold) || 40)) return "skip";
    return "maybe";
  }

  // Fold only what is certainly not worth it, so nobody misses a post they wanted: ads, engagement bait, or a very
  // low signal. Never a post with a worth link, never a personal post. Other Skips keep their label but stay open.
  // ("maybe" mode is the reader's explicit choice to fold everything but Worth it.)
  function autoFold(v, tier, cfg) {
    const collapse = (cfg && cfg.collapse) || "skips";
    if (collapse === "never" || tier === "kind" || tier === "worth") return false;
    if (v.category === "ad") return true;
    if (collapse === "maybe") return true;
    if (tier !== "skip" || (v.worth && v.worth.href)) return false;
    return v.category === "bait" || v.signal < 15;
  }

  // An AI answer may re-word the two lines. Own-provider engines may also re-label, but the post's text can steer the
  // model, so the result is held to the rules: an ad stays an ad, the score moves at most 25 points, the link is always
  // the rules' link (the model may only re-title it), and a reader's correction is never overruled.
  const MAX_SHIFT = 25;
  const str = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
  function mergeAI(base, ai, opts) {
    if (!ai || typeof ai !== "object") return base;
    const v = Object.assign({}, base, { roast: str(ai.roast, 140) || base.roast, gist: str(ai.gist, 260) || base.gist });
    const CATS = root.Unspin.CATS;
    const corrected = opts && opts.corrected;
    if (typeof ai.category === "string" && Object.prototype.hasOwnProperty.call(CATS, ai.category) && !corrected && base.category !== "ad" && ai.category !== "ad") {
      const sig = typeof ai.signal === "number" && isFinite(ai.signal)
        ? Math.round(Math.max(base.signal - MAX_SHIFT, Math.min(base.signal + MAX_SHIFT, ai.signal))) : base.signal;
      const aw = ai.worth, same = aw && base.worth && aw.href && aw.href === base.worth.href;
      Object.assign(v, {
        category: ai.category, label: CATS[ai.category].label, emoji: CATS[ai.category].emoji, kind: !!CATS[ai.category].kind, signal: sig,
        worth: same ? Object.assign({}, base.worth, { title: str(aw.title, 100) || base.worth.title }) : base.worth,
      });
    }
    // Personal hardship found by the rules is never turned into a joke by a model.
    if (base.kind) Object.assign(v, { category: base.category, label: base.label, emoji: base.emoji, kind: true });
    return v;
  }

  root.Unspin = root.Unspin || {};
  Object.assign(root.Unspin, { WORTH_AT, tierOf, autoFold, mergeAI, MAX_SHIFT });
})(typeof globalThis !== "undefined" ? globalThis : this);
