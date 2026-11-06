/*
 * Unspin – content script entry. Finds posts, decodes them, mounts cards, collapses the fluff.
 */
(function () {
  "use strict";
  const U = globalThis.Unspin;
  const api = globalThis.browser || globalThis.chrome;
  if (!U || window.__unspinStarted) return;
  window.__unspinStarted = true;

  let cfg = null;
  const counted = new Set(); // hashes already in today's stats
  const userToggled = new Map(); // hash -> collapsed (user's choice wins)
  const aiResults = new Map(); // hash -> ai verdict
  const records = new Map(); // post element -> record

  // Page-level style: hide collapsed originals, dim noise.
  const style = document.createElement("style");
  style.id = "unspin-global";
  style.textContent = `
    [data-unspin-blur] { filter: blur(5px) saturate(.5); opacity: .4; user-select: none; pointer-events: none; overflow: hidden !important; max-height: 14em; transition: filter .2s, opacity .2s; }
    [data-unspin-dim] { opacity: .55; transition: opacity .2s ease; }
    [data-unspin-dim]:hover, [data-unspin-dim]:focus-within { opacity: 1; }
  `;
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

  function siblingsToHide(site, textEl) {
    const out = [textEl];
    if (site.id === "x") {
      const more = textEl.parentElement && textEl.parentElement.parentElement && textEl.parentElement.parentElement.querySelector("[data-testid='tweet-text-show-more-link']");
      if (more) out.push(more);
    }
    return out;
  }

  function shouldCollapse(v) {
    if (v.kind) return false;
    if (cfg.collapse === "all") return true;
    if (cfg.collapse === "never") return false;
    return v.signal < cfg.threshold;
  }

  // Keep the blurred text at least as tall as the card on top of it.
  function syncHeight(rec) {
    const t = rec.hide[0];
    if (!rec.collapsed) { t.style.minHeight = ""; return; }
    const cs = getComputedStyle(rec.card.cardEl);
    const h = rec.card.cardEl.offsetHeight + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
    if (h) t.style.minHeight = Math.ceil(h) + "px";
  }
  const sizes = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    entries.forEach((e) => { const rec = byCard.get(e.target); if (rec) syncHeight(rec); });
  }) : null;
  const byCard = new WeakMap();

  function apply(rec) {
    const v = rec.ai ? Object.assign({}, rec.local, rec.ai, {
      label: (U.CATS[rec.ai.category] || {}).label || rec.local.label,
      emoji: (U.CATS[rec.ai.category] || {}).emoji || rec.local.emoji,
      kind: rec.ai.category ? !!(U.CATS[rec.ai.category] || {}).kind : rec.local.kind,
      engine: rec.ai.engine,
    }) : rec.local;
    const collapsed = userToggled.has(rec.hash) ? userToggled.get(rec.hash) : shouldCollapse(v);
    rec.hide.forEach((n) => (collapsed ? n.setAttribute("data-unspin-blur", "") : n.removeAttribute("data-unspin-blur")));
    // Blurred: the card floats over the post text. Shown: the card sits above it.
    rec.card.host.style.cssText = collapsed ? "display:block;position:relative;height:0;z-index:3" : "display:block";
    if (cfg.dim && !collapsed && !v.kind && v.signal < cfg.threshold - 15) rec.post.setAttribute("data-unspin-dim", "");
    else rec.post.removeAttribute("data-unspin-dim");
    rec.card.update(v, {
      collapsed,
      showGist: cfg.showGist,
      engineState: rec.engineState,
      error: rec.error,
      onToggle: () => { userToggled.set(rec.hash, !collapsed); apply(rec); },
    });
    rec.collapsed = collapsed;
    syncHeight(rec);
    if (!counted.has(rec.hash)) {
      counted.add(rec.hash);
      send({ type: "stats", data: { words: v.words, minutes: v.minutes, collapsed, fluff: !!(U.CATS[v.category] || {}).fluff, worth: !!v.worth, category: v.category } });
    }
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
    if (cfg.engine !== "auto") { rec.engineState = "loading"; apply(rec); } // auto: show the rules' verdict until the AI answers
    const hash = rec.hash;
    const post = Object.assign({}, rec.payload, { hint: { category: rec.local.category, label: rec.local.label } });
    send({ type: "analyze", post }).then((r) => {
      if (rec.hash !== hash) return; // post was recycled meanwhile
      if (!r || r.skip) { rec.engineState = "local"; }
      else if (r.error) { rec.engineState = cfg.engine === "auto" ? "local" : "error"; rec.error = r.error; }
      else { rec.ai = r; rec.engineState = "ai"; aiResults.set(hash, r); }
      apply(rec);
    });
  }

  function processPost(site, post) {
    const textEl = site.text(post);
    if (!textEl) return;
    const text = U.cleanText(textEl.innerText || textEl.textContent);
    const words = text ? text.split(/\s+/).length : 0;
    const hash = U.hash(text);
    const old = records.get(post);
    if (old && old.hash === hash && old.card.host.isConnected) return;
    // LinkedIn's "…more" changes the text (and hash): keep the reader's show/blur choice.
    if (old && userToggled.has(old.hash) && !userToggled.has(hash)) userToggled.set(hash, userToggled.get(old.hash));
    if (old) { old.card.host.remove(); old.hide.forEach((n) => (n.removeAttribute("data-unspin-blur"), (n.style.minHeight = ""))); post.removeAttribute("data-unspin-dim"); records.delete(post); }
    if (words < cfg.minWords) return;

    const links = site.links(post, textEl);
    const payload = { site: site.id, text, author: site.author(post), links, promoted: site.promoted(post), hash };
    const local = U.classify(payload, { spice: cfg.spice });
    const card = U.createCard(site.id, post);
    textEl.parentNode.insertBefore(card.host, textEl);
    const rec = { post, hash, payload, local, card, hide: siblingsToHide(site, textEl), engineState: cfg.engine === "local" || cfg.engine === "auto" ? "local" : "loading" };
    records.set(post, rec);
    byCard.set(card.cardEl, rec);
    if (sizes) sizes.observe(card.cardEl);
    apply(rec);
    if (cfg.engine !== "local") io.observe(post);
  }

  function scan() {
    if (!cfg || !cfg.enabled) return;
    for (const { el, site } of scopes()) {
      if (!site || cfg.sites[site.id] === false) continue;
      U.findPosts(site, el).forEach((p) => {
        try { processPost(site, p); } catch (e) { console.debug("[unspin]", e); }
      });
    }
    askVisible();
  }

  function teardown() {
    records.forEach((rec, post) => {
      rec.card.host.remove();
      rec.hide.forEach((n) => (n.removeAttribute("data-unspin-blur"), (n.style.minHeight = "")));
      post.removeAttribute("data-unspin-dim");
      io.unobserve(post);
    });
    records.clear();
    aiResults.clear();
  }

  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 250); };
  let scrollTimer = null;
  addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(askVisible, 200); }, { passive: true });

  new MutationObserver((muts) => {
    // ignore our own insertions
    if (muts.every((m) => Array.from(m.addedNodes).every((n) => n.classList && n.classList.contains("unspin-host")))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Follow the site's light/dark switch.
  const themeWatch = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (themeWatch && themeWatch.addEventListener) themeWatch.addEventListener("change", () => records.forEach((r) => r.card.retheme()));

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    globalThis.unspinSettings().then((s) => {
      cfg = s;
      teardown();
      userToggled.clear();
      scan();
    });
  });

  globalThis.unspinSettings().then((s) => {
    cfg = s;
    scan();
  });
})();
