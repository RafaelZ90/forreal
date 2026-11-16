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
  // Rendering-independent text helpers: never innerText, which changes when a post is folded (display: none)
  // and forces a layout on every call. lines() gives each text run its own line, like the visible lines.
  function lines(el) {
    const out = [];
    if (!el) return out;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.data.replace(/\s+/g, " ").trim();
      if (t && !(n.parentElement && n.parentElement.closest(".unspin-host"))) out.push(t);
    }
    return out;
  }
  const txt = (el) => lines(el).join("\n");
  const flat = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "");

  // Text with line breaks taken from the markup (<br>, block elements), not from rendering, so it reads the
  // same whether the post is visible or folded away. Buttons ("…more") are skipped.
  const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE)$/;
  function readText(root) {
    let out = "";
    (function walk(node) {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) out += n.data;
        else if (n.nodeType === 1) {
          if (n.tagName === "BR") { out += "\n"; continue; }
          if (n.tagName === "BUTTON" || n.getAttribute("aria-hidden") === "true" || n.classList.contains("unspin-host")) continue;
          const block = BLOCK.test(n.tagName);
          if (block) out += "\n";
          walk(n);
          if (block) out += "\n";
        }
      }
    })(root);
    return out;
  }

  // Fallback: the element inside the post with the most direct text.
  function largestTextBlock(post) {
    let best = null, bestLen = 0;
    post.querySelectorAll("span[dir], div[dir], div[lang], p, span.break-words, div.break-words").forEach((el) => {
      if (el.closest(".unspin-host, button, a, [role='button']")) return;
      const len = flat(el).length;
      if (len > bestLen && el.querySelectorAll("button, img, video").length < 3) { best = el; bestLen = len; }
    });
    return bestLen > 80 ? best : null;
  }

  function anchors(el) {
    return Array.from(el.querySelectorAll("a[href]")).map((a) => ({ href: a.href, text: flat(a).slice(0, 140) }));
  }

  // "Promoted"/"Ad" in the languages the sites are used in most. Exact leaf text only, so a post that says "ad" is no ad.
  const AD_LABEL = /^(ad|promoted|sponsored|anzeige|gesponsert|werbung|publicidad|promocionado|sponsoris[ée]|sponsorizzato|gesponsord|promowane|reklama)$/i;

  const linkedin = {
    id: "linkedin",
    host: /(^|\.)linkedin\.com$/,
    posts: [
      "[role='listitem'][componentkey^='update-card-focus']", // 2026 markup
      "div.feed-shared-update-v2",
      "div[data-urn^='urn:li:activity']",
      "div[data-id^='urn:li:activity']",
      "[data-view-name='feed-full-update']",
      "div.occludable-update",
    ],
    text(post) {
      // 2026 markup: <p><span data-testid="expandable-text-box">…</span><button>…more</button></p>
      const box = post.querySelector("[data-testid='expandable-text-box']");
      if (box) return box.closest("p") || box;
      return q(post, [
        ".update-components-text",
        ".feed-shared-inline-show-more-text",
        ".feed-shared-update-v2__description",
        ".feed-shared-text",
        "[data-view-name='feed-commentary']",
      ]) || largestTextBlock(post);
    },
    // where the words are (the text element may also hold LinkedIn's "…more" button)
    source: (post) => post.querySelector("[data-testid='expandable-text-box']"),
    author(post) {
      // 2026 markup: the author link carries the connection degree ("Name • 2nd"); earlier links may be
      // "X likes this" context lines. Company posts have no degree, so fall back to the first named profile.
      const links = Array.from(post.querySelectorAll("a[href*='/in/'], a[href*='/company/']")).filter((a) => !a.closest("[data-testid='expandable-text-box']"));
      const named = links.map((a) => txt(a).split(/\n|\s\/\s/)[0].replace(/\s*•.*$/, "").trim()).filter(Boolean);
      const withDegree = links.find((a) => /•\s*(1st|2nd|3rd|1\.|2\.|3\.)/.test(txt(a)));
      if (withDegree) return txt(withDegree).split(/\n|\s\/\s/)[0].replace(/\s*•.*$/, "").trim();
      if (named.length) return named[0];
      return txt(q(post, [
        ".update-components-actor__title span[aria-hidden='true']",
        ".update-components-actor__name span[aria-hidden='true']",
        ".update-components-actor__name",
        ".feed-shared-actor__name",
        "[data-view-name='feed-actor-name']",
      ])).split("\n")[0];
    },
    promoted(post) {
      if (Array.from(post.querySelectorAll("span, p")).some((el) => el.children.length === 0 && AD_LABEL.test(flat(el)))) return true;
      const sub = q(post, [".update-components-actor__sub-description", ".update-components-actor__description", ".feed-shared-actor__sub-description"]);
      return /\b(promoted|gesponsert|sponsored|anzeige)\b/i.test(flat(sub));
    },
    links(post, textEl) {
      const out = textEl ? anchors(textEl) : [];
      // external link cards anywhere in the post (2026 markup has no stable class for them)
      Array.from(post.querySelectorAll("a[href^='http']")).forEach((a) => {
        let host = "";
        try { host = new URL(a.href).hostname; } catch (e) { return; }
        if (/(^|\.)linkedin\.com$/.test(host) || out.some((l) => l.href === a.href)) return;
        // the card's title: a line of words, not the bare domain or a button label
        const title = lines(a).find((t) => t.length > 8 && !/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(t) && !/^(learn more|mehr erfahren|apply|apply now|register|sign up|jetzt bewerben|anmelden)$/i.test(t)) || "";
        out.push({ href: a.href, title, text: title });
      });
      const card = q(post, [".update-components-article", ".feed-shared-article", ".update-components-entity", "[data-view-name='feed-article']"]);
      if (card) {
        const a = card.querySelector("a[href]");
        const title = flat(q(card, [".update-components-article__title", ".feed-shared-article__title", ".update-components-entity__title", "h2", "h3"]));
        if (a) out.unshift({ href: a.href, title, text: title });
      }
      const doc = q(post, [".update-components-document__container", ".feed-shared-document"]);
      if (doc) out.push({ href: location.href, title: flat(q(doc, ["h2", "h3", ".document-s-container__title"])) || "Attached document" });
      return out;
    },
  };

  const x = {
    id: "x",
    host: /(^|\.)(x|twitter)\.com$/,
    posts: ["article[data-testid='tweet']", "[data-testid='cellInnerDiv'] article[role='article']"],
    // tweet text carries a lang attribute even when its test id changes
    text: (post) => post.querySelector("[data-testid='tweetText']") || post.querySelector("div[lang][dir]") || largestTextBlock(post),
    avatar: (post) => post.querySelector("[data-testid='Tweet-User-Avatar']"),
    name: (post) => post.querySelector("[data-testid='User-Name']"),
    author: (post) => txt(post.querySelector("[data-testid='User-Name']")).split("\n")[0],
    promoted: (post) => !!post.querySelector("[data-testid='placementTracking']") ||
      Array.from(post.querySelectorAll("span")).some((s) => s.children.length === 0 && AD_LABEL.test(flat(s))),
    links(post, textEl) {
      const out = textEl ? anchors(textEl).filter((l) => !/\/(hashtag|search)|^https?:\/\/(x|twitter)\.com\/[^/]+\/?$/.test(l.href)) : [];
      const card = post.querySelector("[data-testid='card.wrapper']");
      if (card) {
        const a = card.querySelector("a[href]");
        const spans = Array.from(card.querySelectorAll("span")).filter((e) => !e.querySelector("span")).map(flat).filter((t) => t.length > 12);
        if (a) out.unshift({ href: a.href, title: spans[0] || flat(a), text: spans[0] || "" });
      }
      return out;
    },
  };

  const bsky = {
    id: "bsky",
    host: /(^|\.)bsky\.app$/,
    posts: ["[data-testid^='feedItem-by-']", "[data-testid^='postThreadItem-by-']", "[data-testid^='postThreadItem-']"],
    text: (post) => post.querySelector("[data-testid='postText']") || largestTextBlock(post),
    // The separator line is drawn on the post's inner block: put the verdict inside it, below the line.
    mount: (post) => Array.from(post.children).find((c) => !c.classList.contains("unspin-host")) || post,
    avatar: (post) => post.querySelector("[data-testid='userAvatarImage']"),
    name(post) {
      const handle = (post.getAttribute("data-testid") || "").replace(/^(feedItem|postThreadItem)-by-/, "");
      return Array.from(post.querySelectorAll("a[href='/profile/" + handle + "']")).find((a) => txt(a) && txt(a)[0] !== "@");
    },
    author(post) {
      // data-testid="feedItem-by-<handle>"; the first link to that profile with visible text is the display name
      // (an earlier link may be "Reposted by …").
      const handle = (post.getAttribute("data-testid") || "").replace(/^(feedItem|postThreadItem)-by-/, "");
      const name = Array.from(post.querySelectorAll("a[href='/profile/" + handle + "']")).map(txt).find((t) => t && t[0] !== "@");
      return (name || handle).split("\n")[0];
    },
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
  root.Unspin.readText = readText;
  root.Unspin.siteFor = function (hostname, demoSiteId) {
    if (demoSiteId) return ALL.find((s) => s.id === demoSiteId) || null;
    return ALL.find((s) => s.host.test(hostname)) || null;
  };
  root.Unspin.findPosts = function (site, scope) {
    const seen = new Set();
    const out = [];
    const any = site._any || (site._any = site.posts.join(","));
    for (const sel of site.posts) {
      scope.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        // keep the outermost match only (LinkedIn nests reshared updates)
        const outer = el.parentElement && el.parentElement.closest(any);
        if (outer && scope.contains(outer)) return;
        seen.add(el);
        out.push(el);
      });
    }
    return out;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
