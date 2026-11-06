/*
 * Site adapters: where posts are, where their text is, who wrote them, which links they carry.
 * Selectors are lists, newest markup first, because these sites change class names often.
 */
(function (root) {
  "use strict";

  const qAll = (el, sels) => {
    for (const s of sels) {
      const found = el.querySelectorAll(s);
      if (found.length) return Array.from(found);
    }
    return [];
  };
  const q = (el, sels) => {
    for (const s of sels) {
      const f = el.querySelector(s);
      if (f) return f;
    }
    return null;
  };
  const txt = (el) => (el ? (el.innerText || el.textContent || "").trim() : "");

  // Fallback: the element inside the post with the most direct text.
  function largestTextBlock(post) {
    let best = null, bestLen = 0;
    post.querySelectorAll("span[dir], div[dir], p, span.break-words, div.break-words").forEach((el) => {
      const len = txt(el).length;
      if (len > bestLen && el.querySelectorAll("button, img, video").length < 3) { best = el; bestLen = len; }
    });
    return bestLen > 80 ? best : null;
  }

  function anchors(el) {
    return Array.from(el.querySelectorAll("a[href]")).map((a) => ({ href: a.href, text: txt(a).slice(0, 140) }));
  }

  const linkedin = {
    id: "linkedin",
    host: /(^|\.)linkedin\.com$/,
    posts: [
      "div.feed-shared-update-v2",
      "div[data-urn^='urn:li:activity']",
      "div[data-id^='urn:li:activity']",
      "[data-view-name='feed-full-update']",
      "div.occludable-update",
    ],
    text(post) {
      return q(post, [
        ".update-components-text",
        ".feed-shared-inline-show-more-text",
        ".feed-shared-update-v2__description",
        ".feed-shared-text",
        "[data-view-name='feed-commentary']",
      ]) || largestTextBlock(post);
    },
    author(post) {
      return txt(q(post, [
        ".update-components-actor__title span[aria-hidden='true']",
        ".update-components-actor__name span[aria-hidden='true']",
        ".update-components-actor__name",
        ".feed-shared-actor__name",
        "[data-view-name='feed-actor-name']",
      ])).split("\n")[0];
    },
    promoted(post) {
      const sub = q(post, [".update-components-actor__sub-description", ".update-components-actor__description", ".feed-shared-actor__sub-description"]);
      return /\b(promoted|gesponsert|sponsored)\b/i.test(txt(sub));
    },
    links(post, textEl) {
      const out = textEl ? anchors(textEl) : [];
      const card = q(post, [".update-components-article", ".feed-shared-article", ".update-components-entity", "[data-view-name='feed-article']"]);
      if (card) {
        const a = card.querySelector("a[href]");
        const title = txt(q(card, [".update-components-article__title", ".feed-shared-article__title", ".update-components-entity__title", "h2", "h3"]));
        if (a) out.unshift({ href: a.href, title, text: title });
      }
      const doc = q(post, [".update-components-document__container", ".feed-shared-document"]);
      if (doc) out.push({ href: location.href, title: txt(q(doc, ["h2", "h3", ".document-s-container__title"])) || "Attached document" });
      return out;
    },
  };

  const x = {
    id: "x",
    host: /(^|\.)(x|twitter)\.com$/,
    posts: ["article[data-testid='tweet']"],
    text: (post) => post.querySelector("[data-testid='tweetText']"),
    author: (post) => txt(post.querySelector("[data-testid='User-Name']")).split("\n")[0],
    promoted: (post) => /^(ad|promoted|anzeige)$/im.test(txt(post.querySelector("[data-testid='placementTracking']") || null)) ||
      Array.from(post.querySelectorAll("span")).some((s) => /^(Ad|Promoted)$/.test(txt(s))),
    links(post, textEl) {
      const out = textEl ? anchors(textEl).filter((l) => !/\/(hashtag|search)|^https?:\/\/(x|twitter)\.com\/[^/]+\/?$/.test(l.href)) : [];
      const card = post.querySelector("[data-testid='card.wrapper']");
      if (card) {
        const a = card.querySelector("a[href]");
        const spans = Array.from(card.querySelectorAll("span")).map(txt).filter((t) => t.length > 12);
        if (a) out.unshift({ href: a.href, title: spans[0] || txt(a), text: spans[0] || "" });
      }
      return out;
    },
  };

  const bsky = {
    id: "bsky",
    host: /(^|\.)bsky\.app$/,
    posts: ["[data-testid^='feedItem-by-']", "[data-testid^='postThreadItem-by-']"],
    text: (post) => post.querySelector("[data-testid='postText']") || largestTextBlock(post),
    author: (post) => txt(post.querySelector("a[href^='/profile/'] span, a[href^='/profile/']")).split("\n")[0],
    promoted: () => false,
    links(post, textEl) {
      const out = textEl ? anchors(textEl).filter((l) => !/bsky\.app\/(profile|hashtag|search)/.test(l.href)) : [];
      const ext = post.querySelector("a[href^='http']:not([href*='bsky.app'])");
      if (ext && !out.some((l) => l.href === ext.href)) out.push({ href: ext.href, title: txt(ext).split("\n")[0] });
      return out;
    },
  };

  const ALL = [linkedin, x, bsky];

  root.Unspin = root.Unspin || {};
  root.Unspin.sites = ALL;
  root.Unspin.siteFor = function (hostname, demoSiteId) {
    if (demoSiteId) return ALL.find((s) => s.id === demoSiteId) || null;
    return ALL.find((s) => s.host.test(hostname)) || null;
  };
  root.Unspin.findPosts = function (site, scope) {
    const seen = new Set();
    const out = [];
    for (const sel of site.posts) {
      scope.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        // keep the outermost match only (LinkedIn nests reshared updates)
        const outer = el.parentElement && el.parentElement.closest(site.posts.join(","));
        if (outer && scope.contains(outer)) return;
        seen.add(el);
        out.push(el);
      });
    }
    return out;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
