// The real content scripts on the made-up feeds (test/demo.html) and the classifier table (test/run.html) in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { serve, launch } from "./browser.mjs";
import { loadRules, readJSON, FIXTURE_FILES } from "./load.mjs";

// What Node finds, so the browser table must agree exactly (same scripts, other engine).
function nodeCounts() {
  const ctx = loadRules(), C = ctx.UnspinChecks;
  const all = [...C.fromDemo(ctx.DEMO_LI), ...C.fromDemo(ctx.DEMO_X), ...FIXTURE_FILES.flatMap(readJSON)];
  const rs = all.map((p) => C.check(ctx.Unspin, p).ok);
  return { pass: rs.filter((x) => x === true).length, total: all.length };
}

let srv, browser;
test.before(async () => { srv = await serve(); browser = await launch(); });
test.after(async () => { if (browser) await browser.close(); if (srv) srv.server.close(); });

const need = (t) => { if (!browser) { if (process.env.CI) assert.fail("Playwright is missing"); t.skip("Playwright not installed (npm ci)"); return false; } return true; };

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(srv.base + path);
  return { page, errors };
}

test("run.html: classifier table passes in the browser too", async (t) => {
  if (!need(t)) return;
  const { page, errors } = await open("/test/run.html");
  const r = await page.waitForFunction(() => window.__result, null, { timeout: 15000 }).then((h) => h.jsonValue());
  assert.equal(r.fail, 0, await page.textContent("#sum"));
  const n = nodeCounts();
  assert.equal(r.total, n.total, "all fixture files loaded");
  assert.equal(r.pass, n.pass, "same results as in Node");
  assert.deepEqual(errors, []);
  await page.close();
});

test("demo.html?selftest: Show/Fold stays put", async (t) => {
  if (!need(t)) return;
  const { page, errors } = await open("/test/demo.html?selftest");
  await page.waitForSelector("#selftest", { timeout: 20000 });
  assert.match(await page.textContent("#selftest"), /SELFTEST PASS/);
  assert.deepEqual(errors, []);
  await page.close();
});

test("demo feed: lines, folds and links as the owner's goals say", async (t) => {
  if (!need(t)) return;
  const { page, errors } = await open("/test/demo.html");
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const posts = Array.from(document.querySelectorAll("#li .feed-shared-update-v2, #xf article"));
    return posts.map((p) => {
      const host = p.querySelector(".unspin-host");
      const sr = host && host.shadowRoot;
      return {
        text: (p.querySelector(".update-components-text, [data-testid=tweetText]") || {}).textContent.slice(0, 50),
        tier: host && host.getAttribute("data-tier"),
        shown: !!host && host.style.display !== "none",
        folded: p.hasAttribute("data-unspin-fold") || !!p.querySelector("[data-unspin-fold]"),
        link: sr && sr.querySelector("a.link") ? sr.querySelector("a.link").href : "",
        about: sr && sr.querySelector(".about") ? sr.querySelector(".about").textContent : "",
        line: sr ? sr.querySelector(".line").textContent : "",
        first: host ? host.parentElement.firstElementChild === host : null,
        styled: sr ? getComputedStyle(sr.querySelector(".strip")).display === "flex" : null,
      };
    });
  });
  assert.ok(r.length >= 10, "posts in demo: " + r.length);
  for (const p of r) {
    if (!p.tier) continue;
    if (p.folded) {
      assert.notEqual(p.tier, "worth", "worth-it never folds: " + p.text);
      assert.notEqual(p.tier, "kind", "personal never folds: " + p.text);
      assert.equal(p.link, "", "a post with a worth link never folds: " + p.text);
      assert.ok(p.about.length > 10, "a folded post says what it was about: " + p.text);
    }
    if (p.link) assert.match(p.link, /^https?:\/\//);
    if (p.shown) { assert.equal(p.styled, true, "the line is styled"); assert.ok(p.line.length > 0, "the line has text"); assert.equal(p.first, true, "the line sits on top"); }
  }
  assert.ok(r.some((p) => p.folded), "something folds");
  const status = await page.evaluate(() => chrome.runtime._deliver({ type: "pageStatus" }));
  assert.equal(status.posts, r.filter((p) => p.tier).length, "popup page status counts the judged posts");
  assert.equal(status.folded, r.filter((p) => p.folded).length);
  assert.ok(r.some((p) => p.tier === "worth" && p.link), "worth-it posts carry their link");
  assert.deepEqual(errors, []);
  await page.close();
});

test("performance: a long feed is judged quickly and re-scans stay cheap", async (t) => {
  if (!need(t)) return;
  const { page, errors } = await open("/test/demo.html?many=30");
  const n = await page.evaluate(() => document.querySelectorAll("#li .feed-shared-update-v2, #xf article").length);
  await page.waitForFunction((n) => document.querySelectorAll(".unspin-host").length >= n * 0.9, n, { timeout: 15000 });
  const first = await page.evaluate(() => chrome.runtime._deliver({ type: "pageStatus" }));
  // nothing changed: a re-scan only compares texts
  for (let i = 0; i < 5; i++) { await page.evaluate(() => document.body.appendChild(document.createElement("i"))); await page.waitForTimeout(260); }
  const again = await page.evaluate(() => chrome.runtime._deliver({ type: "pageStatus" }));
  t.diagnostic(n + " posts; first full scan max " + first.scanMax + " ms; idle re-scan " + again.scanMs + " ms");
  assert.ok(n > 300);
  assert.ok(first.scanMax < 4000, "first scan " + first.scanMax + " ms");
  assert.ok(again.scanMs < 60, "idle re-scan " + again.scanMs + " ms");
  assert.deepEqual(errors, []);
  await page.close();
});
