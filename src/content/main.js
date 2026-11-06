/*
 * ForReal – content script entry. Finds posts, judges them, puts a one-line verdict on top,
 * folds the posts not worth your time.
 */
(function () {
  "use strict";
  const U = globalThis.Unspin;
  const api = globalThis.browser || globalThis.chrome;
  if (!U || window.__unspinStarted) return;
  window.__unspinStarted = true;

  const WORTH_AT = 65; // signal from which a post is "Worth it"
  let cfg = null;
  const counted = new Set(); // hashes already in today's stats
  const userFold = new Map(); // hash -> folded (the reader's choice wins)
  const aiResults = new Map(); // hash -> ai lines
  const overrides = new Map(); // hash -> category the reader chose
  const records = new Map(); // post element -> record
  const CATEGORY_LIST = Object.keys(U.CATS).map((k) => [k, U.CATS[k].label]);

  const style = document.createElement("style");
  style.id = "unspin-global";
  style.textContent = `[data-unspin-fold] > :not(.unspin-host) { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);

  function send(msg) {
    try {
      return api.runtime.sendMessage(msg).catch((e) => ({ error: String(e && e.message || e) }));
    } catch (e) {
      return Promise.resolve({ error: "Extension was reloaded; refresh the page." });
    }
  }

  function scopes() {
    // Demo/test pages mark feeds with data-unspin-site; real sites are matched by host.
    const marked = document.querySelectorAll("[data-unspin-site]");
    if (marked.length) return Array.from(marked).map((s) => ({ el: s, site: U.siteFor(null, s.getAttribute("data-unspin-site")) }));
    const site = U.siteFor(location.hostname);
    return site ? [{ el: document, site }] : [];
  }

  function tierOf(v) {
    if (v.kind) return "kind";
    if (v.signal >= WORTH_AT) return "worth";
    if (v.signal < cfg.threshold) return "skip";
    return "maybe";
  }
  function autoFold(tier) {
    if (cfg.collapse === "never") return false;
    if (tier === "skip") return true;
    return cfg.collapse === "maybe" && tier === "maybe";
  }

  function verdictOf(rec) {
    let v = rec.local;
    if (overrides.has(rec.hash)) v = U.relabel(v, overrides.get(rec.hash), cfg.spice);
    if (rec.ai) v = Object.assign({}, v, { roast: rec.ai.roast || v.roast, gist: rec.ai.gist || v.gist },
      rec.ai.category && !overrides.has(rec.hash) && U.CATS[rec.ai.category] ? { // own-provider engines may re-label
        category: rec.ai.category, label: U.CATS[rec.ai.category].label, kind: !!U.CATS[rec.ai.category].kind,
        signal: typeof rec.ai.signal === "number" ? rec.ai.signal : v.signal, worth: rec.ai.worth || v.worth,
      } : {});
    return v;
  }

  function apply(rec) {
    const v = verdictOf(rec);
    const tier = tierOf(v);
    const folded = userFold.has(rec.hash) ? userFold.get(rec.hash) : autoFold(tier);
    rec.post.toggleAttribute("data-unspin-fold", folded);
    rec.strip.update(v, {
      tier, folded, canFold: tier !== "worth" && tier !== "kind",
      jokes: cfg.jokes !== false,
      engineState: rec.engineState,
      categories: CATEGORY_LIST,
      onFold: () => { userFold.set(rec.hash, !folded); apply(rec); },
      onRelabel: (cat) => relabel(rec, v, cat),
    });
    if (!counted.has(rec.hash)) {
      counted.add(rec.hash);
      send({ type: "stats", data: { words: v.words, minutes: v.minutes, collapsed: folded, fluff: tier === "skip", worth: tier === "worth", category: v.category } });
    }
  }

  // The reader says the label is wrong: remember it for this post, and keep an example for tuning the rules.
  async function relabel(rec, v, cat) {
    overrides.set(rec.hash, cat);
    userFold.delete(rec.hash);
    apply(rec);
    try {
      const got = await api.storage.local.get(["overrides", "corrections"]);
      const ov = got.overrides || {};
      ov[rec.hash] = cat;
      const keys = Object.keys(ov);
      if (keys.length > 2000) keys.slice(0, keys.length - 2000).forEach((k) => delete ov[k]);
      const corr = (got.corrections || []).concat([{
        at: new Date().toISOString(), site: rec.payload.site, from: v.category, to: cat,
        text: rec.payload.text.slice(0, 1200), links: (rec.payload.links || []).slice(0, 3).map((l) => l.href),
      }]).slice(-300);
      await api.storage.local.set({ overrides: ov, corrections: corr });
    } catch (e) { /* storage unavailable: the correction still applies on this page */ }
  }

  // Ask the AI only for posts near the viewport.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const rec = records.get(e.target);
      if (rec) askAI(rec);
    });
  }, { rootMargin: "600px 0px" });

  function nearViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > -600 && r.top < innerHeight + 600 && (r.width || r.height);
  }
  // Fallback for when IntersectionObserver is throttled (background tabs, some embedded views).
  function askVisible() {
    if (!cfg || cfg.engine === "local") return;
    records.forEach((rec) => { if (!rec.asked && nearViewport(rec.post)) askAI(rec); });
  }

  function askAI(rec) {
    if (cfg.engine === "local" || rec.asked) return;
    rec.asked = true;
    if (aiResults.has(rec.hash)) { rec.ai = aiResults.get(rec.hash); rec.engineState = "ai"; apply(rec); return; }
    const hash = rec.hash;
    const post = Object.assign({}, rec.payload, { hint: { category: rec.local.category, label: rec.local.label } });
    send({ type: "analyze", post }).then((r) => {
      if (rec.hash !== hash || !records.has(rec.post)) return; // post was recycled meanwhile
      if (r && !r.skip && !r.error) { rec.ai = r; rec.engineState = "ai"; aiResults.set(hash, r); apply(rec); }
    });
  }

  function remove(rec) {
    rec.strip.host.remove();
    rec.post.removeAttribute("data-unspin-fold");
    io.unobserve(rec.post);
    records.delete(rec.post);
  }

  function processPost(site, post) {
    const textEl = site.text(post);
    if (!textEl) return;
    const raw = textEl.textContent || ""; // cheap check first; innerText only when something changed
    const old = records.get(post);
    if (old && old.raw === raw && old.strip.host.isConnected) return;
    const text = U.cleanText(textEl.innerText || raw);
    const hash = U.hash(text);
    if (old && old.hash === hash && old.strip.host.isConnected) { old.raw = raw; return; }
    // LinkedIn's "…more" changes the text (and hash): keep the reader's choices.
    if (old && userFold.has(old.hash) && !userFold.has(hash)) userFold.set(hash, userFold.get(old.hash));
    if (old && overrides.has(old.hash) && !overrides.has(hash)) overrides.set(hash, overrides.get(old.hash));
    if (old) remove(old);
    const words = text ? text.split(/\s+/).length : 0;
    if (words < cfg.minWords) return;

    const payload = { site: site.id, text, author: site.author(post), links: site.links(post, textEl), promoted: site.promoted(post), hash };
    const local = U.classify(payload, { spice: cfg.spice });
    const strip = U.createStrip(site.id, post);
    // The strip is the post's first child. In a side-by-side (row) flex layout it gets its own full-width row.
    const cs = getComputedStyle(post);
    if (/flex/.test(cs.display) && !/column/.test(cs.flexDirection)) {
      post.style.flexWrap = "wrap";
      strip.host.style.cssText = "display:block;flex:0 0 100%;width:100%";
    }
    post.insertBefore(strip.host, post.firstChild);
    const rec = { post, raw, hash, payload, local, strip, engineState: "local" };
    records.set(post, rec);
    apply(rec);
    if (cfg.engine !== "local") io.observe(post);
  }

  function scan() {
    pending = false;
    if (!cfg || !cfg.enabled) return;
    for (const { el, site } of scopes()) {
      if (!site || cfg.sites[site.id] === false) continue;
      U.findPosts(site, el).forEach((p) => {
        try { processPost(site, p); } catch (e) { console.debug("[forreal]", e); }
      });
    }
    records.forEach((rec) => { if (!rec.post.isConnected) records.delete(rec.post); });
    askVisible();
  }

  function teardown() {
    Array.from(records.values()).forEach(remove);
    aiResults.clear();
  }

  // Scan at most every 200 ms while the page changes. (A debounce that waits for quiet never fires on
  // LinkedIn, whose feed changes constantly.) Also scan a few times right after load and navigation.
  let pending = false;
  const schedule = () => { if (!pending) { pending = true; setTimeout(scan, 200); } };
  const burst = () => [300, 1000, 2500, 5000].forEach((t) => setTimeout(schedule, t));
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) if (!(n.classList && n.classList.contains("unspin-host"))) return schedule();
      if (m.type === "characterData") return schedule();
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  let scrollTimer = null;
  addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => { schedule(); askVisible(); }, 150); }, { passive: true });
  let lastUrl = location.href;
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; burst(); } }, 500); // in-app navigation

  // Follow the site's light/dark switch.
  const themeWatch = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (themeWatch && themeWatch.addEventListener) themeWatch.addEventListener("change", () => records.forEach((r) => r.strip.retheme()));

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    globalThis.unspinSettings().then((s) => {
      cfg = s;
      teardown();
      userFold.clear();
      scan();
    });
  });

  Promise.all([
    globalThis.unspinSettings(),
    api.storage.local.get("overrides").then((r) => r.overrides || {}, () => ({})),
  ]).then(([s, ov]) => {
    Object.keys(ov).forEach((k) => overrides.set(k, ov[k]));
    cfg = s;
    scan();
    burst();
  });
})();
