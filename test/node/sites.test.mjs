// Site adapters against invented markup: current, older and drifted variants, open and folded.
import test from "node:test";
import assert from "node:assert/strict";
import { serve, launch } from "./browser.mjs";

let srv, browser, page;
test.before(async () => {
  srv = await serve();
  browser = await launch();
  if (!browser) return;
  page = await browser.newPage();
  await page.goto(srv.base + "/test/run.html"); // any page of ours; the adapters are injected below
  for (const f of ["src/content/classifier.js", "src/content/policy.js", "src/content/sites.js"]) await page.addScriptTag({ url: srv.base + "/" + f });
});
test.after(async () => { if (browser) await browser.close(); if (srv) srv.server.close(); });
const need = (t) => { if (!browser) { if (process.env.CI) assert.fail("Playwright is missing"); t.skip("Playwright not installed"); return false; } return true; };

// Puts the markup in a scratch box, runs the adapter on every post, reads each post open and folded.
const run = (site, html) => page.evaluate(({ site, html }) => {
  const U = window.Unspin;
  const box = document.createElement("div");
  box.id = "scratch";
  document.getElementById("scratch")?.remove();
  box.innerHTML = html; // test markup only; the extension itself never does this
  document.body.appendChild(box);
  const s = U.siteFor(null, site);
  const read = (p) => {
    const t = s.text(p);
    const src = (s.source && s.source(p)) || t;
    return { text: t ? U.cleanText(U.readText(src)) : null, author: s.author(p), promoted: s.promoted(p), links: s.links(p, t).map((l) => ({ href: l.href, title: l.title || "" })) };
  };
  return U.findPosts(s, box).map((p) => {
    const open = read(p);
    p.style.display = "none"; // as folded: rendering must not change what is read
    const folded = read(p);
    p.style.display = "";
    return { open, same: JSON.stringify(open) === JSON.stringify(folded), folded };
  });
}, { site, html });

const LONG = "We just open-sourced Tidewater, the record-linkage library we have used in production for two years. It matches 50M company records in under an hour on one machine.";

test("LinkedIn 2026 markup", async (t) => {
  if (!need(t)) return;
  const r = await run("linkedin", `
  <div role="listitem" componentkey="update-card-focus-1">
    <a href="https://www.linkedin.com/in/someone/"><span>Ana Example likes this</span></a>
    <a href="https://www.linkedin.com/in/priya/"><div><span>Priya Example</span><span> • 2nd</span></div><div>Data engineer</div></a>
    <p><span data-testid="expandable-text-box">${LONG}<br><br>Repo: <a href="https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fgithub.com%2Fexample%2Ftidewater">github.com/example/tidewater</a></span><button>…more</button></p>
    <a href="https://example.org/blog/tidewater"><div>example.org</div><div>Why we built Tidewater</div></a>
  </div>
  <div role="listitem" componentkey="update-card-focus-2">
    <a href="https://www.linkedin.com/company/acme/"><span>Acme Analytics</span></a><p><span>Promoted</span></p>
    <p><span data-testid="expandable-text-box">Dashboards in five minutes. Try it free for fourteen days and see how much time your team saves.</span></p>
  </div>`);
  assert.equal(r.length, 2);
  const [a, b] = r;
  assert.match(a.open.text, /^We just open-sourced Tidewater/);
  assert.doesNotMatch(a.open.text, /more$/);
  assert.match(a.open.text, /\n\nRepo:/, "line breaks come from <br>");
  assert.equal(a.open.author, "Priya Example");
  assert.equal(a.open.promoted, false);
  assert.ok(a.open.links.some((l) => l.href.includes("github.com") || l.href.includes("redir")));
  assert.ok(a.open.links.some((l) => l.href === "https://example.org/blog/tidewater" && l.title === "Why we built Tidewater"));
  assert.equal(b.open.promoted, true);
  assert.equal(b.open.author, "Acme Analytics");
  assert.ok(a.same && b.same, "folded reads the same as open");
});

test("LinkedIn older markup and nested reshares", async (t) => {
  if (!need(t)) return;
  const r = await run("linkedin", `
  <div class="feed-shared-update-v2" data-urn="urn:li:activity:1">
    <div class="update-components-actor__title"><span aria-hidden="true">Lena Example</span></div>
    <div class="update-components-actor__sub-description">Gesponsert</div>
    <div class="update-components-text"><span dir="ltr">${LONG}</span></div>
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:2"><div class="update-components-text"><span dir="ltr">The reshared post inside.</span></div></div>
  </div>`);
  assert.equal(r.length, 1, "outermost only");
  assert.equal(r[0].open.promoted, true, "German 'Gesponsert'");
  assert.match(r[0].open.text, /Tidewater/);
  assert.ok(r[0].same);
});

test("LinkedIn drifted markup: unknown classes fall back to the largest text block", async (t) => {
  if (!need(t)) return;
  const r = await run("linkedin", `
  <div data-urn="urn:li:activity:3"><div class="x9a"><button>Follow</button></div><div class="q7z"><div dir="ltr">${LONG}</div></div></div>`);
  assert.equal(r.length, 1);
  assert.match(r[0].open.text, /Tidewater/);
  assert.ok(r[0].same);
});

test("X markup, ads, and a drifted tweet text", async (t) => {
  if (!need(t)) return;
  const r = await run("x", `
  <article data-testid="tweet">
    <div data-testid="User-Name"><a href="/priya"><span>Priya N.</span></a><span>@priya_builds</span></div>
    <div data-testid="tweetText" lang="en" dir="auto">${LONG} <a href="https://x.com/hashtag/opensource">#opensource</a></div>
    <div data-testid="card.wrapper"><a href="https://t.co/abc"><span><span>github.com</span></span><span>Tidewater: fast record linkage</span></a></div>
  </article>
  <article data-testid="tweet"><div data-testid="User-Name"><span>Shop</span></div><div data-testid="tweetText" lang="en" dir="auto">Big sale on running shoes this weekend only, everything must go.</div><div><span>Ad</span></div></article>
  <div data-testid="cellInnerDiv"><article role="article"><div lang="de" dir="auto">${LONG}</div></article></div>`);
  assert.equal(r.length, 3);
  assert.equal(r[0].open.author, "Priya N.");
  assert.equal(r[0].open.links[0].title, "Tidewater: fast record linkage");
  assert.ok(!r[0].open.links.some((l) => /hashtag/.test(l.href)));
  assert.equal(r[1].open.promoted, true);
  assert.equal(r[0].open.promoted, false);
  assert.match(r[2].open.text, /Tidewater/, "div[lang] fallback");
  assert.ok(r.every((x) => x.same));
});

test("Bluesky markup with a 'Reposted by' line", async (t) => {
  if (!need(t)) return;
  const r = await run("bsky", `
  <div data-testid="feedItem-by-sam.example.social"><div>
    <a href="/profile/kim.example.social">Reposted by Kim</a>
    <a href="/profile/sam.example.social">Sam Ortiz</a><a href="/profile/sam.example.social">@sam.example.social</a>
    <div data-testid="postText">Reminder: my livestream is tomorrow at noon Eastern. RSVP below and bring your questions about films on a tiny budget.</div>
    <a href="https://example.org/events/ortiz-live">Live Q&amp;A with Sam Ortiz</a>
  </div></div>`);
  assert.equal(r.length, 1);
  assert.equal(r[0].open.author, "Sam Ortiz");
  assert.equal(r[0].open.links[0].href, "https://example.org/events/ortiz-live");
  assert.ok(r[0].same);
});

test("the classifier ignores ad words in the text: only the label makes an ad", async (t) => {
  if (!need(t)) return;
  const r = await run("x", `<article data-testid="tweet"><div data-testid="User-Name"><span>A</span></div><div data-testid="tweetText" lang="en" dir="auto">Ad hoc analysis is underrated. Promoted to lead last year, I still do it every week.</div></article>`);
  assert.equal(r[0].open.promoted, false);
});
