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

  const tierOf = (v) => U.tierOf(v, cfg);
  const autoFold = (v, tier) => U.autoFold(v, tier, cfg);

  function verdictOf(rec) {
    let v = rec.local;
    const corrected = overrides.has(rec.hash);
    if (corrected) v = U.relabel(v, overrides.get(rec.hash), cfg.spice);
    return rec.ai ? U.mergeAI(v, rec.ai, { corrected }) : v; // AI answers are held to the rules (policy.js)
  }

  function apply(rec) {
    const v = verdictOf(rec);
    const tier = tierOf(v);
    // The automatic fold is decided once per post and then kept: a re-read may update the line, never make it jump.
    // (LinkedIn shows a slightly different text for a folded post than for an open one.)
    if (rec.autoFold === undefined) rec.autoFold = autoFold(v, tier);
    // The reader's Show/Fold click belongs to the post itself and always wins.
    if (rec.userFold === undefined && userFold.has(rec.hash)) rec.userFold = userFold.get(rec.hash);
    const folded = rec.userFold !== undefined ? rec.userFold : rec.autoFold;
    // Ordinary posts (plain, nothing to say) get no line unless the reader wants one.
    const quiet = !cfg.showPlain && v.category === "plain" && tier === "maybe" && !folded;
    rec.strip.host.style.display = quiet ? "none" : "block";
    rec.box.toggleAttribute("data-unspin-fold", folded);
    rec.strip.update(v, {
      tier, folded, canFold: tier !== "worth" && tier !== "kind",
      jokes: cfg.jokes !== false,
      engineState: rec.engineState,
      categories: CATEGORY_LIST,
      onFold: () => { rec.userFold = !folded; userFold.set(rec.hash, rec.userFold); apply(rec); },
      onRelabel: (cat) => relabel(rec, v, cat),
    });
    if (!rec.counted && !counted.has(rec.hash)) {
      rec.counted = true;
      counted.add(rec.hash);
      send({ type: "stats", data: { words: v.words, minutes: v.minutes, collapsed: folded, fluff: tier === "skip", worth: tier === "worth", category: v.category } });
    }
  }

  // The reader says the label is wrong: remember it for this post, and keep an example for tuning the rules.
  async function relabel(rec, v, cat) {
    overrides.set(rec.hash, cat);
    userFold.delete(rec.hash);
    rec.autoFold = undefined; // a corrected label may fold or unfold once
    rec.userFold = undefined;
    apply(rec);
    // Saved by the background (storage.local, which holds API keys, is closed to content scripts).
    send({ type: "correction", hash: rec.hash, correction: {
      site: rec.payload.site, from: v.category, to: cat,
      text: rec.payload.text.slice(0, 1200), links: (rec.payload.links || []).slice(0, 3).map((l) => l.href),
    } });
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
    rec.box.removeAttribute("data-unspin-fold");
    io.unobserve(rec.post);
    records.delete(rec.post);
  }

  const mountOf = (site, post) => (site.mount && site.mount(post)) || post;

  // X/Bluesky: line the verdict up with the avatar and name columns (measured before any folding).
  function alignTo(site, post, strip) {
    if (!site.avatar || !site.name) return;
    const a = site.avatar(post), n = site.name(post);
    if (!a || !n) return;
    const h = strip.host.getBoundingClientRect(), ar = a.getBoundingClientRect(), nr = n.getBoundingClientRect();
    if (!h.width || !ar.width || !nr.width) return;
    strip.align(ar.left - h.left, ar.width, nr.left - ar.right);
  }

  function processPost(site, post) {
    const textEl = site.text(post);
    if (!textEl) return;
    const src = (site.source && site.source(post)) || textEl; // the words only, without "…more" buttons
    const raw = src.textContent || "";
    const old = records.get(post);
    if (old && old.raw === raw && old.strip.host.isConnected) return;
    const text = U.cleanText(U.readText(src)); // same result whether the post is shown or folded
    const hash = U.hash(text);
    if (old && old.hash === hash && old.strip.host.isConnected) { old.raw = raw; return; }
    const words = text ? text.split(/\s+/).length : 0;

    if (old) {
      // Same post, changed text (LinkedIn's "…more", lazy loading): update in place, keep the reader's choices
      // and the fold, and put the line back if the site removed it.
      if (overrides.has(old.hash) && !overrides.has(hash)) overrides.set(hash, overrides.get(old.hash));
      if (words >= cfg.minWords) {
        old.raw = raw; old.hash = hash;
        old.payload = { site: site.id, text, author: site.author(post), links: site.links(post, textEl), promoted: site.promoted(post), hash };
        old.local = U.classify(old.payload, { spice: cfg.spice });
        old.ai = aiResults.get(hash) || null;
        if (!old.strip.host.isConnected) { old.box = mountOf(site, post); old.box.insertBefore(old.strip.host, old.box.firstChild); }
        apply(old);
        return;
      }
      remove(old);
    }
    const promoted = site.promoted(post);
    if (words < cfg.minWords && !promoted) return; // ads are judged at any length

    const payload = { site: site.id, text, author: site.author(post), links: site.links(post, textEl), promoted, hash };
    const local = U.classify(payload, { spice: cfg.spice });
    const strip = U.createStrip(site.id, post);
    // The strip is the first child of the post (or of the block the site says, see site.mount).
    // In a side-by-side (row) flex layout it gets its own full-width row.
    const box = mountOf(site, post);
    const cs = getComputedStyle(box);
    if (/flex/.test(cs.display) && !/column/.test(cs.flexDirection)) {
      box.style.flexWrap = "wrap";
      strip.host.style.cssText = "display:block;flex:0 0 100%;width:100%";
    }
    box.insertBefore(strip.host, box.firstChild);
    alignTo(site, post, strip);
    const rec = { post, box, raw, hash, payload, local, strip, engineState: "local" };
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
    send({ type: "overrides" }).then((r) => (r && r.overrides) || {}),
  ]).then(([s, ov]) => {
    Object.keys(ov).forEach((k) => overrides.set(k, ov[k]));
    cfg = s;
    scan();
    burst();
  });
})();
