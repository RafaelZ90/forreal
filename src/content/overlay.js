/*
 * ForReal – the verdict strip. One line at the top of each post: is it worth your time?
 * Lives in a shadow root so the site's CSS can't touch it. Themed per site (LinkedIn, X, Bluesky; light/dark).
 */
(function (root) {
  "use strict";

  const TIERS = {
    worth: { icon: "✅", label: "Worth it" },
    maybe: { icon: "🟡", label: "Maybe" },
    skip: { icon: "⛔", label: "Skip" },
    kind: { icon: "🤍", label: "Personal" },
  };

  const CSS = `
  :host { all: initial; display: block; }
  * { box-sizing: border-box; }
  .strip {
    --tier: #5e6b78;
    font-family: var(--font); color: var(--fg); font-size: 13px; line-height: 1.3;
    display: flex; align-items: center; gap: 8px; min-width: 0;
    padding: var(--pad); margin: var(--margin);
    background: color-mix(in srgb, var(--tier) 7%, transparent);
    border-radius: var(--radius); cursor: pointer; user-select: none;
    animation: in .18s ease-out;
  }
  .strip:hover { background: color-mix(in srgb, var(--tier) 12%, transparent); }
  @keyframes in { from { opacity: 0; } to { opacity: 1; } }
  .tier { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--tier); white-space: nowrap; }
  .cat { color: var(--muted); white-space: nowrap; font-weight: 600; }
  .sep { color: var(--muted); opacity: .6; }
  .line { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .strip.two { flex-wrap: wrap; row-gap: 2px; }
  .about { flex: 0 0 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted);
    padding-left: calc(var(--icon-w, 18px) + var(--gap, 4px)); }
  .line.joke { font-style: italic; }
  .link {
    white-space: nowrap; font-weight: 700; color: var(--worth); text-decoration: none;
    padding: 2px 8px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--worth) 40%, transparent);
  }
  .link:hover { background: color-mix(in srgb, var(--worth) 10%, transparent); }
  .btn { font: inherit; font-weight: 600; color: var(--link); background: none; border: 0; padding: 0; cursor: pointer; white-space: nowrap; }
  .btn:hover { text-decoration: underline; }
  .chev { color: var(--muted); font-size: 11px; transition: transform .15s; }
  .open .chev { transform: rotate(180deg); }
  .details {
    font-family: var(--font); color: var(--fg); font-size: 13px; line-height: 1.4;
    margin: var(--details-margin); padding: 8px 12px 10px; border-left: 2px solid color-mix(in srgb, var(--tier) 50%, transparent);
  }
  .details p { margin: 0 0 6px; }
  .details .k { color: var(--muted); font-weight: 600; }
  .details .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
  select { font: inherit; font-size: 12px; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 2px 4px; }
  .thanks { color: var(--worth); font-weight: 600; }
  :host([data-tier="worth"]) .strip, :host([data-tier="worth"]) .details { --tier: var(--worth); }
  :host([data-tier="maybe"]) .strip, :host([data-tier="maybe"]) .details { --tier: var(--maybe); }
  :host([data-tier="skip"]) .strip, :host([data-tier="skip"]) .details { --tier: var(--skip); }
  :host([data-tier="kind"]) .strip, :host([data-tier="kind"]) .details { --tier: #8a6fb5; }
  :host([data-theme^="linkedin"]) { --radius: 6px; --pad: 7px 12px; --margin: 8px 12px 0; --details-margin: 4px 16px 0; }
  :host([data-theme^="x"]) { --radius: 10px; --pad: 6px 10px; --margin: 6px 12px 2px; --details-margin: 4px 16px 0; }
  :host([data-theme^="bsky"]) { --radius: 8px; --pad: 6px 10px; --margin: 6px 12px 2px; --details-margin: 4px 16px 0; }
  :host([data-folded]) .strip { margin-bottom: 8px; }
  .icon { flex: none; }
  /* X and Bluesky: look like the site's own context line ("You reposted"): no box, icon in the avatar column,
     text starting at the name column (offsets measured from the post, see align()). */
  :host([data-theme^="x"]) .strip, :host([data-theme^="bsky"]) .strip {
    background: transparent; border-radius: 0; margin: 0; padding: 10px 0 0 var(--lead, 0); gap: 6px; color: var(--muted);
  }
  :host([data-theme^="x"]) .strip:hover, :host([data-theme^="bsky"]) .strip:hover { background: transparent; }
  :host([data-theme^="x"]) .strip:hover .line, :host([data-theme^="bsky"]) .strip:hover .line { text-decoration: underline; }
  :host([data-theme^="x"]) .icon, :host([data-theme^="bsky"]) .icon { width: var(--icon-w, auto); text-align: right; margin-right: calc(var(--gap, 6px) - 6px); }
  :host([data-theme^="x"]) .tier, :host([data-theme^="bsky"]) .tier { font-weight: 700; }
  :host([data-theme^="x"]) .cat, :host([data-theme^="bsky"]) .cat { font-weight: 400; }
  :host([data-theme^="x"]) .line, :host([data-theme^="bsky"]) .line { color: var(--muted); }
  :host([data-theme^="x"]) .link, :host([data-theme^="bsky"]) .link { border: 0; padding: 0; }
  :host([data-theme^="x"]) .link:hover, :host([data-theme^="bsky"]) .link:hover { background: transparent; text-decoration: underline; }
  :host([data-theme^="x"]) .btn, :host([data-theme^="bsky"]) .btn { color: var(--muted); font-weight: 400; }
  :host([data-theme^="x"]) .details, :host([data-theme^="bsky"]) .details { margin: 4px 0 0 calc(var(--lead, 0px) + var(--icon-w, 0px) + var(--gap, 8px)); padding: 4px 0 2px 10px; }
  :host([data-theme^="x"][data-folded]) .strip, :host([data-theme^="bsky"][data-folded]) .strip { padding-bottom: 10px; }
  :host([data-theme="linkedin-light"]) { --font: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; --bg: #fff; --fg: rgba(0,0,0,.9); --muted: rgba(0,0,0,.6); --line: rgba(140,140,140,.35); --link: #0a66c2; --worth: #057642; --maybe: #9a6b00; --skip: #b3261e; }
  :host([data-theme="linkedin-dark"]) { --font: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; --bg: #1b1f23; --fg: rgba(255,255,255,.9); --muted: rgba(255,255,255,.6); --line: rgba(255,255,255,.2); --link: #71b7fb; --worth: #5ec27a; --maybe: #e8b339; --skip: #f07167; }
  :host([data-theme="x-light"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; --bg: #fff; --fg: #0f1419; --muted: #536471; --line: #cfd9de; --link: #1d9bf0; --worth: #00875a; --maybe: #9a6b00; --skip: #c62828; }
  :host([data-theme="x-dim"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, sans-serif; --bg: #15202b; --fg: #f7f9f9; --muted: #8b98a5; --line: #38444d; --link: #1d9bf0; --worth: #3fcf8e; --maybe: #f2c94c; --skip: #ff6b6b; }
  :host([data-theme="x-dark"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, sans-serif; --bg: #000; --fg: #e7e9ea; --muted: #71767b; --line: #2f3336; --link: #1d9bf0; --worth: #3fcf8e; --maybe: #f2c94c; --skip: #ff6b6b; }
  :host([data-theme="bsky-light"]) { --font: InterVariable, Inter, -apple-system, system-ui, sans-serif; --bg: #fff; --fg: #0b0f14; --muted: #6f869f; --line: #d4dbe2; --link: #1083fe; --worth: #00875a; --maybe: #9a6b00; --skip: #c62828; }
  :host([data-theme="bsky-dark"]) { --font: InterVariable, Inter, -apple-system, system-ui, sans-serif; --bg: #161e27; --fg: #f1f3f5; --muted: #8798b0; --line: #2e4052; --link: #208bfe; --worth: #3fcf8e; --maybe: #f2c94c; --skip: #ff6b6b; }
  `;

  function luminance(rgb) {
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m) return 1;
    const [r, g, b] = m.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function backgroundOf(el) {
    while (el && el !== document.documentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      el = el.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
  }
  function themeFor(siteId, post) {
    const l = luminance(backgroundOf(post));
    if (siteId === "x") return l > 0.5 ? "x-light" : l < 0.03 ? "x-dark" : "x-dim";
    if (siteId === "bsky") return l > 0.5 ? "bsky-light" : "bsky-dark";
    return l > 0.5 ? "linkedin-light" : "linkedin-dark";
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const mins = (m) => (m < 1 ? Math.round(m * 60) + " s" : m.toFixed(1) + " min");

  /**
   * createStrip(siteId, post) -> {host, update(v, st), retheme()}
   * v:  verdict {category, label, roast, gist, signal, worth, words, minutes}
   * st: {tier, folded, canFold, jokes, engineState, categories:[[id,label]], onFold(), onRelabel(cat)}
   */
  function createStrip(siteId, post) {
    const host = document.createElement("div");
    host.className = "unspin-host";
    try { host.setAttribute("data-forreal", (globalThis.chrome || {}).runtime.getManifest().version); } catch (e) { /* demo page */ }
    host.setAttribute("data-theme", themeFor(siteId, post));
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const strip = el("div", "strip");
    strip.setAttribute("role", "button");
    strip.tabIndex = 0;
    const details = el("div", "details");
    details.hidden = true;
    shadow.append(strip, details);
    let open = false;
    let thanks = false;
    let last = null;

    function update(v, st) {
      last = [v, st];
      host.setAttribute("data-tier", st.tier);
      host.toggleAttribute("data-folded", !!st.folded);
      const T = TIERS[st.tier];
      strip.textContent = "";
      strip.classList.toggle("open", open);
      strip.title = "ForReal · signal " + v.signal + "/100 · click for details";
      strip.appendChild(el("span", "icon", T.icon));
      strip.appendChild(el("span", "tier", T.label));
      if (st.tier !== "kind") strip.append(el("span", "cat", v.label), el("span", "sep", "·"));

      // The one line: worth-it posts say what is worth it; the rest get the joke (or the gist).
      let text, joke = false;
      if (st.tier === "worth") text = (v.worth && v.worth.title) || v.gist;
      else if (st.tier === "kind") text = v.gist || v.roast;
      else if (st.jokes) { text = v.roast; joke = true; }
      else text = v.gist || v.roast;
      strip.appendChild(el("span", "line" + (joke ? " joke" : ""), text));

      const href = v.worth && globalThis.Unspin.safeUrl(v.worth.href);
      if (href) {
        const a = el("a", "link", "→ " + (v.worth.host || "open"));
        a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.title = v.worth.title || v.worth.href;
        strip.appendChild(a);
      }
      if (st.folded || st.canFold) {
        const b = el("button", "btn", st.folded ? "Show post" : "Fold");
        b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); st.onFold(); });
        strip.appendChild(b);
      }
      strip.appendChild(el("span", "chev", "▾"));
      // Folded: still say in one sentence what the post is about, so the reader can decide to open it.
      const aboutText = st.folded && v.gist && v.gist !== text ? v.gist : "";
      strip.classList.toggle("two", !!aboutText);
      if (aboutText) { const ab = el("span", "about", aboutText); ab.title = aboutText; strip.appendChild(ab); }

      // Details: what it says, the joke, how sure, and a way to correct the label.
      details.textContent = "";
      details.hidden = !open;
      if (v.gist && text !== v.gist && !st.folded) {
        const p = el("p"); p.append(el("span", "k", "What it says: "), document.createTextNode(v.gist)); details.appendChild(p);
      }
      if (v.roast && text !== v.roast && st.tier !== "kind") {
        const p = el("p"); p.append(el("span", "k", "Translation: "), document.createTextNode("“" + v.roast + "”")); details.appendChild(p);
      }
      const row = el("div", "row");
      row.appendChild(el("span", "", "Signal " + v.signal + "/100 · " + v.words + " words · " + mins(v.minutes) +
        " · " + (st.engineState === "ai" ? "lines by on-device AI" : "rules")));
      if (thanks) row.appendChild(el("span", "thanks", "Saved, thanks"));
      else {
        const sel = el("select");
        sel.appendChild(new Option("Wrong label?", ""));
        st.categories.forEach(([id, label]) => { if (id !== v.category) sel.appendChild(new Option(label, id)); });
        sel.addEventListener("change", () => { if (sel.value) { thanks = true; st.onRelabel(sel.value); } });
        row.appendChild(sel);
      }
      details.appendChild(row);
    }

    const toggle = (e) => {
      if (e && e.target && e.target.closest && e.target.closest("a,button,select")) return;
      open = !open;
      if (last) update(last[0], last[1]);
    };
    strip.addEventListener("click", toggle);
    strip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    // Clicks inside must not open the post (LinkedIn/X make whole posts clickable).
    host.addEventListener("click", (e) => e.stopPropagation());
    // Line up with the post's own columns: lead = avatar's left edge, icon-w = avatar width, gap = avatar to name.
    function align(lead, iconW, gap) {
      host.style.setProperty("--lead", Math.max(0, Math.round(lead)) + "px");
      host.style.setProperty("--icon-w", Math.round(iconW) + "px");
      host.style.setProperty("--gap", Math.max(4, Math.round(gap)) + "px");
    }
    return { host, update, align, retheme: () => host.setAttribute("data-theme", themeFor(siteId, post)) };
  }

  root.Unspin = root.Unspin || {};
  root.Unspin.createStrip = createStrip;
  root.Unspin.TIERS = TIERS;
})(typeof globalThis !== "undefined" ? globalThis : this);
