/*
 * The decoded card. Lives in a shadow root so the site's CSS can't touch it and ours can't leak.
 * Themes follow the host site so LinkedIn still feels like LinkedIn and X like X.
 */
(function (root) {
  "use strict";

  const ACCENT = {
    job: "#c37d16", brag: "#d0530c", bait: "#cc1016", lesson: "#a35a00", broetry: "#b24020",
    sales: "#c2185b", hype: "#7b3fe4", listicle: "#a35a00", ad: "#6b6b6b", take: "#d0530c", plain: "#5e6b78",
    hiring: "#0a66c2", personal: "#8a6fb5", paper: "#057642", event: "#057642", release: "#057642", insight: "#057642",
  };

  const CSS = `
  :host { all: initial; display: block; }
  * { box-sizing: border-box; }
  .card {
    --accent: #0a66c2;
    font-family: var(--font);
    color: var(--fg);
    background: color-mix(in srgb, var(--accent) 7%, var(--bg));
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line));
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    padding: 10px 12px 10px 12px;
    margin: var(--margin);
    line-height: 1.35;
    animation: in .25s ease-out;
    position: relative;
  }
  .card.over { position: absolute; top: 0; left: 0; right: 0; z-index: 3;
    background: color-mix(in srgb, var(--accent) 6%, var(--bg));
    box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 28px rgba(0,0,0,.14); }
  @keyframes in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
  .top { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-size: 12px;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 2px 8px 2px 6px; border-radius: 999px; white-space: nowrap;
  }
  .meter { display: inline-flex; gap: 2px; align-items: center; }
  .meter i { width: 6px; height: 10px; border-radius: 2px; background: var(--line); }
  .meter i.on { background: var(--sig); }
  .sig { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--sig); }
  .spacer { flex: 1; }
  .engine { font-size: 11px; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); }
  .engine.ai { color: #7b3fe4; border-color: color-mix(in srgb, #7b3fe4 40%, transparent); }
  .engine.err { color: #cc1016; }
  .brand { font-weight: 700; letter-spacing: -.01em; font-size: 11px; color: var(--muted); opacity: .8; }
  .brand b { color: var(--fg); }
  .roast { margin: 7px 0 0; font-size: var(--roast-size); font-weight: 600; letter-spacing: -.005em; }
  .roast.kind { font-weight: 500; }
  .roast.loading { color: var(--muted); }
  .gist { margin: 3px 0 0; font-size: 14px; color: var(--muted); }
  .gist b { font-weight: 600; color: var(--fg); opacity: .75; }
  .worth {
    display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 7px 10px; border-radius: calc(var(--radius) - 2px);
    background: var(--bg); border: 1px solid color-mix(in srgb, #057642 35%, var(--line));
    text-decoration: none; color: var(--fg); font-size: 13px; transition: border-color .15s, transform .15s;
  }
  .worth:hover { border-color: #057642; transform: translateY(-1px); }
  .worth .lbl { color: #057642; font-weight: 700; white-space: nowrap; }
  .worth .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .worth .h { color: var(--muted); font-size: 12px; white-space: nowrap; margin-left: auto; }
  .worth.nolink { cursor: default; }
  .actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 12px; color: var(--muted); }
  button {
    font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; color: var(--link);
    background: transparent; border: 0; padding: 3px 0; border-radius: 4px;
  }
  button:hover { text-decoration: underline; }
  .saved { margin-left: auto; }
  :host([data-theme$="dark"]) .chip, :host([data-theme="x-dim"]) .chip { color: color-mix(in srgb, var(--accent) 55%, white); }
  :host([data-theme$="dark"]) .worth .lbl, :host([data-theme="x-dim"]) .worth .lbl { color: #3fb950; }
  :host([data-theme$="dark"]) .card, :host([data-theme="x-dim"]) .card { background: color-mix(in srgb, var(--accent) 12%, var(--bg)); }
  :host([data-theme^="linkedin"]) .card { --radius: 8px; --roast-size: 15px; --margin: 4px 16px 8px; }
  :host([data-theme^="x"]) .card { --radius: 16px; --roast-size: 15px; --margin: 6px 0 8px; }
  :host([data-theme^="bsky"]) .card { --radius: 12px; --roast-size: 15px; --margin: 6px 0 8px; }
  :host([data-theme="linkedin-light"]) { --font: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Fira Sans", Ubuntu, Oxygen, Cantarell, "Droid Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif; --bg: #ffffff; --fg: rgba(0,0,0,.9); --muted: rgba(0,0,0,.6); --line: rgba(140,140,140,.3); --link: #0a66c2; }
  :host([data-theme="linkedin-dark"]) { --font: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; --bg: #1b1f23; --fg: rgba(255,255,255,.9); --muted: rgba(255,255,255,.6); --line: rgba(255,255,255,.18); --link: #71b7fb; }
  :host([data-theme="x-light"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; --bg: #ffffff; --fg: #0f1419; --muted: #536471; --line: #cfd9de; --link: #1d9bf0; }
  :host([data-theme="x-dim"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; --bg: #15202b; --fg: #f7f9f9; --muted: #8b98a5; --line: #38444d; --link: #1d9bf0; }
  :host([data-theme="x-dark"]) { --font: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; --bg: #000000; --fg: #e7e9ea; --muted: #71767b; --line: #2f3336; --link: #1d9bf0; }
  :host([data-theme="bsky-light"]) { --font: InterVariable, Inter, -apple-system, system-ui, sans-serif; --bg: #ffffff; --fg: #0b0f14; --muted: #6f869f; --line: #d4dbe2; --link: #1083fe; }
  :host([data-theme="bsky-dark"]) { --font: InterVariable, Inter, -apple-system, system-ui, sans-serif; --bg: #161e27; --fg: #f1f3f5; --muted: #8798b0; --line: #2e4052; --link: #208bfe; }
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
    const bg = backgroundOf(post);
    const l = luminance(bg);
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

  function sigColor(s) {
    return s >= 65 ? "#057642" : s >= 40 ? "#b07d00" : "#cc1016";
  }

  /**
   * Create a card host. Returns {host, update(verdict, state)}.
   * state: {collapsed, onToggle, engineState: "local"|"loading"|"ai"|"error", error, showGist}
   */
  function createCard(siteId, post) {
    const host = document.createElement("div");
    host.className = "unspin-host";
    host.setAttribute("data-theme", themeFor(siteId, post));
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const card = el("div", "card");
    card.setAttribute("role", "note");
    shadow.appendChild(card);

    function update(v, st) {
      card.textContent = "";
      card.classList.toggle("over", !!st.collapsed);
      card.style.setProperty("--accent", ACCENT[v.category] || "#0a66c2");
      card.style.setProperty("--sig", sigColor(v.signal));
      card.setAttribute("aria-label", "Unspin: " + v.label + ". " + v.roast);

      const top = el("div", "top");
      const chip = el("span", "chip");
      chip.append(el("span", "", v.emoji), el("span", "", v.label));
      const meter = el("span", "meter");
      meter.title = "Signal " + v.signal + "/100: how much this post is worth your attention";
      const on = Math.round(v.signal / 20);
      for (let i = 0; i < 5; i++) meter.appendChild(el("i", i < on ? "on" : ""));
      top.append(chip, meter, el("span", "sig", String(v.signal)), el("span", "spacer"));
      const eng = el("span", "engine");
      if (st.engineState === "ai") { eng.classList.add("ai"); eng.textContent = "✨ AI"; eng.title = v.engine === "chrome" ? "Lines written by Chrome's on-device AI; genre and score by Unspin's rules" : "Decoded by " + v.engine; }
      else if (st.engineState === "loading") { eng.textContent = "✨ …"; eng.title = "Asking the AI"; }
      else if (st.engineState === "error") { eng.classList.add("err"); eng.textContent = "local"; eng.title = "AI failed, showing the local decoder: " + (st.error || ""); }
      else { eng.textContent = "local"; eng.title = "Decoded on this device, no AI"; }
      const brand = el("span", "brand");
      brand.innerHTML = "<b>un</b>spin";
      top.append(eng, brand);
      card.appendChild(top);

      const roast = el("p", "roast" + (v.kind ? " kind" : ""), v.kind ? v.roast : "“" + v.roast + "”");
      card.appendChild(roast);

      if (st.showGist && v.gist && v.gist !== v.roast) card.appendChild(el("p", "gist", v.gist));

      if (v.worth && (v.worth.href || v.worth.title)) {
        const a = el(v.worth.href ? "a" : "div", "worth" + (v.worth.href ? "" : " nolink"));
        if (v.worth.href) { a.href = v.worth.href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.append(el("span", "lbl", "→ Worth your time"), el("span", "t", v.worth.title || v.worth.host), el("span", "h", v.worth.host || ""));
        card.appendChild(a);
      }

      const actions = el("div", "actions");
      const btn = el("button", "", st.collapsed ? "Show post (" + v.words + " words)" : "Blur it again");
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); st.onToggle(); });
      actions.appendChild(btn);
      const mins = v.minutes < 1 ? Math.round(v.minutes * 60) + " s" : v.minutes.toFixed(1) + " min";
      actions.appendChild(el("span", "saved", st.collapsed ? "≈ " + mins + " saved" : "≈ " + mins + " read"));
      card.appendChild(actions);
    }

    // Clicks inside the card must not open the post (LinkedIn/X make whole posts clickable).
    host.addEventListener("click", (e) => e.stopPropagation());
    return { host, update, cardEl: card, retheme: () => host.setAttribute("data-theme", themeFor(siteId, post)) };
  }

  root.Unspin = root.Unspin || {};
  root.Unspin.createCard = createCard;
})(typeof globalThis !== "undefined" ? globalThis : this);
