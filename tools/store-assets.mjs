// Store screenshots (1280x800) and the small promo tile (440x280), made from the invented demo feed only.
// npm run store:assets   ->  store/screenshots/*.png, store/promo-440x280.png
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { serve, launch } from "../test/node/browser.mjs";
import { ROOT } from "../test/node/load.mjs";

const OUT = path.join(ROOT, "store", "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await serve();
const browser = await launch();
if (!browser) throw new Error("Playwright is needed: npm ci && npx playwright install chromium");

// A caption band on top, the feed below; the demo page's own toolbar is hidden.
const CAPTION = (title, sub) => `
  (() => {
    document.querySelector(".bar").style.display = "none";
    const c = document.createElement("div");
    c.style.cssText = "position:sticky;top:0;z-index:5;background:linear-gradient(90deg,#6d4aff,#ff4f8b);color:#fff;padding:22px 40px;font:600 30px/1.2 -apple-system,system-ui,sans-serif";
    const t = document.createElement("div"); t.textContent = ${JSON.stringify(title)};
    const s = document.createElement("div"); s.textContent = ${JSON.stringify(sub)}; s.style.cssText = "font-weight:400;font-size:17px;opacity:.92;margin-top:6px";
    c.append(t, s); document.body.prepend(c);
  })()`;

async function shot(name, url, { caption, setup, scrollTo, dark } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: dark ? "dark" : "light" });
  await page.goto(base + url);
  await page.waitForTimeout(1500);
  if (setup) await page.evaluate(setup);
  if (caption) await page.evaluate(CAPTION(...caption));
  if (scrollTo) await page.evaluate(scrollTo);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name) });
  await page.close();
  console.log("wrote store/screenshots/" + name);
}

const ONLY = (sel) => `document.querySelectorAll(".cols > section").forEach((s) => { if (!s.matches(${JSON.stringify(sel)})) s.style.display = "none"; });
  document.querySelector(".cols").style.gridTemplateColumns = "minmax(0, 640px)";`;
const SCROLL_TO = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); })()`;

await shot("1-linkedin.png", "/test/demo.html", {
  caption: ["Is this post worth your time?", "One quiet line on every LinkedIn, X and Bluesky post: Worth it, Maybe or Skip, with the genre."],
  setup: ONLY("#li"),
});
await shot("2-worth-it-link.png", "/test/demo.html", {
  caption: ["The real thing, one click away", "Papers, workshops, tools, datasets and job openings get their link right in the line."],
  setup: ONLY("#li"), scrollTo: SCROLL_TO("#li .feed-shared-update-v2:nth-of-type(2)"),
});
await shot("3-folded-junk.png", "/test/demo.html", {
  caption: ["Junk folds to one line", "Ads, bait and near-empty posts fold away, with one sentence of what they were about. Show post opens it."],
  setup: ONLY("#li"), scrollTo: SCROLL_TO("#li [data-unspin-fold]"),
});
await shot("4-x-context-line.png", "/test/demo.html", {
  caption: ["Looks like the site", "On X and Bluesky the verdict is a context line, aligned with the name. No boxes, no clutter."],
  setup: ONLY("section[data-unspin-site=x]"),
});
await shot("5-details.png", "/test/demo.html", {
  caption: ["What it says, and how sure", "Click a line for the gist, the score, the joke, and \"Wrong label?\". Everything stays on your computer."],
  setup: ONLY("#li") + `document.querySelectorAll("#li .unspin-host")[1].shadowRoot.querySelector(".strip").click();`,
  scrollTo: SCROLL_TO("#li .feed-shared-update-v2:nth-of-type(2)"),
});

// Popup and settings, side by side, from the preview pages (test/make_previews.py).
execFileSync("python3", [path.join(ROOT, "test", "make_previews.py")]);
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<!doctype html><body style="margin:0;background:#f4f2ee;font:15px -apple-system,system-ui,sans-serif">
    <div style="background:linear-gradient(90deg,#6d4aff,#ff4f8b);color:#fff;padding:22px 40px;font:600 30px/1.2 -apple-system,system-ui,sans-serif">Free, private, no account
      <div style="font-weight:400;font-size:17px;opacity:.92;margin-top:6px">Rules run in your browser. Chrome's on-device AI can word the lines. No server, no tracking.</div></div>
    <div style="display:flex;gap:40px;justify-content:center;padding:28px">
      <iframe src="${base}/test/popup-preview.html" style="width:360px;height:600px;border:0;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);background:#fff"></iframe>
      <iframe src="${base}/test/options-preview.html" style="width:720px;height:600px;border:0;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);background:#fff"></iframe>
    </div></body>`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "6-popup-settings.png") });
  await page.close();
  console.log("wrote store/screenshots/6-popup-settings.png");
}

// Small promo tile.
{
  const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
  const row = (icon, tier, color, cat, text) => `<div style="display:flex;gap:7px;align-items:center;background:rgba(255,255,255,.94);border-radius:8px;padding:7px 10px;margin-top:7px;font-size:13px;white-space:nowrap;overflow:hidden">
    <span>${icon}</span><b style="color:${color}">${tier}</b><span style="color:#667085">${cat} ·</span><span style="overflow:hidden;text-overflow:ellipsis;color:#16181d">${text}</span></div>`;
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;width:440px;height:280px;overflow:hidden;background:linear-gradient(135deg,#6d4aff,#ff4f8b);font-family:-apple-system,system-ui,sans-serif;color:#fff">
    <div style="padding:22px 24px">
      <div style="font-size:30px;font-weight:300"><span style="font-weight:800">For</span>Real</div>
      <div style="font-size:15px;opacity:.95;margin-top:2px">Is this post worth your time?</div>
      <div style="margin-top:12px">
        ${row("✅", "Worth it", "#057642", "Research", "New paper on DAO governance")}
        ${row("🟡", "Maybe", "#9a6b00", "Hot take", "An opinion, with confidence.")}
        ${row("⛔", "Skip", "#b3261e", "Engagement bait", "Comment so the algorithm loves me.")}
      </div></div></body>`);
  await page.screenshot({ path: path.join(ROOT, "store", "promo-440x280.png") });
  await page.close();
  console.log("wrote store/promo-440x280.png");
}

await browser.close();
server.close();
