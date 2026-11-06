/*
 * Unspin – local decoder. Runs entirely in the page, no network.
 * classify({text, author, links, promoted}, {spice}) -> verdict
 *
 * A verdict: {category, label, emoji, roast, gist, signal, worth, words, minutes, engine}
 */
(function (root) {
  "use strict";

  // ---------- categories ----------
  // fluff: true  -> counts against signal
  // kind:  true  -> never roasted (personal hardship)
  const CATS = {
    job:      { label: "New job",          emoji: "💼", fluff: true },
    brag:     { label: "Humblebrag",       emoji: "🏆", fluff: true },
    bait:     { label: "Engagement bait",  emoji: "🎣", fluff: true },
    lesson:   { label: "Fake life lesson", emoji: "🧘", fluff: true },
    broetry:  { label: "Broetry",          emoji: "🎭", fluff: true },
    sales:    { label: "Sales pitch",      emoji: "💸", fluff: true },
    hype:     { label: "AI hype",          emoji: "🤖", fluff: true },
    listicle: { label: "Listicle",         emoji: "📋", fluff: true },
    ad:       { label: "Ad",               emoji: "📣", fluff: true },
    hiring:   { label: "Hiring",           emoji: "🧲", fluff: false },
    personal: { label: "Personal",         emoji: "🤍", fluff: false, kind: true },
    paper:    { label: "Research",         emoji: "📄", fluff: false, substance: true },
    event:    { label: "Event / workshop", emoji: "🎤", fluff: false, substance: true },
    release:  { label: "Launch / tool",    emoji: "🛠️", fluff: false, substance: true },
    insight:  { label: "Actual insight",   emoji: "💡", fluff: false, substance: true },
    take:     { label: "Hot take",         emoji: "🌶️", fluff: false },
    plain:    { label: "Plain post",       emoji: "💬", fluff: false },
  };

  // [regex, weight]. Case-insensitive. English first, some German.
  const P = {
    job: [
      [/\b(thrilled|excited|happy|delighted|pleased|proud) to (announce|share)\b/, 3],
      [/\b(starting|started) a new (position|role|job|chapter)\b/, 5],
      [/\bnew (chapter|adventure|journey|role)\b/, 2],
      [/\b(i('| a)m|i have) (joined|joining)\b/, 4],
      [/\bfirst (day|week) (at|as)\b/, 4],
      [/\b(i('ve| have| was| got)( been| just)? promoted|my promotion)\b/, 4], // first person only
      [/\bfreue mich.{0,40}(neue|anzukündigen|bekannt)/, 4],
      [/\bmy last day at\b/, 3],
    ],
    brag: [
      [/\b(humbled|honou?red|blessed|grateful|privileged)\b/, 2],
      [/\b(award|awarded|winner|won|recogni[sz]ed|named (a|one of)|top \d+|top voice|forbes|30 under 30)\b/, 2],
      [/\bkeynote\b/, 1],
      [/\b(proud of (myself|my|the team)|so proud)\b/, 2],
      [/\b(milestone|followers|\d+k followers)\b/, 2],
      [/\b(featured in|spoke at|invited to speak)\b/, 2],
      [/\bstolz\b/, 2],
    ],
    bait: [
      [/\bagree\s*\?/, 4],
      [/\b(thoughts|what do you think|what would you do|who else)\s*\?/, 2],
      [/\b(comment|type|drop) ['"“]?[a-z]{2,10}['"”]? (below|in the comments)\b/, 5],
      [/\b(like|repost|share) (if|this if)\b/, 4],
      [/♻️|\brepost to\b|\bshare (this )?with your network\b/, 3],
      [/\bfollow (me )?for more\b/, 3],
      [/\b(let that sink in|read that again)\b/, 4],
      [/\bunpopular opinion\b/, 2],
    ],
    lesson: [
      [/\bmy (son|daughter|kid|toddler|grandma|dog|uber driver|barista)\b/, 3],
      [/\b(taught me|lessons? (i learned|from)|here'?s what i learned|what .{0,30} taught me)\b/, 3],
      [/\b(story ?time|a few years ago,? i|i was (rejected|fired|broke))\b/, 2],
      [/\b(nobody talks about|no one tells you|the truth is)\b/, 2],
      [/\b(b2b|leadership|sales) lessons?\b/, 3],
    ],
    sales: [
      [/\b(dm me|dm you|send me a dm|message me|link in (the )?(comments|bio))\b/, 4],
      [/\b(book a (call|demo)|free [\w ]{0,15}(guide|ebook|template|checklist|masterclass|course|playbook))\b/, 4],
      [/\b(limited (spots|seats)|early bird|\d+% off|discount code|use code)\b/, 4],
      [/\b(my (course|cohort|newsletter|coaching)|subscribe)\b/, 2],
      [/\b(10x|scale your|grow your (business|audience))\b/, 2],
    ],
    hype: [
      [/\b(ai|gpt|chatgpt|llms?|agents?|agentic|genai|claude|gemini|copilot)\b/, 1],
      [/\b((changed|changes|change) everything|game[- ]?changer|revolutioni[sz]e|disrupt|the future of|is dead|you'?re (falling|being left) behind)\b/, 2],
      [/\b(prompts?|\d+ (ai )?tools)\b/, 1],
    ],
    hiring: [
      [/#hiring\b|\bwe('| a)re hiring\b|\b(open|new) (role|position|vacancy)\b/, 5],
      [/\bjoin (our|my) team\b|\bwir suchen\b|\bapply (here|now|below)\b/, 4],
    ],
    personal: [
      [/\b(passed away|rest in peace|\brip\b|funeral|cancer|diagnos(is|ed)|miscarriage|grief|depression|burn ?out)\b/, 6],
      [/\b(laid off|been let go|lost my job|open to work|#opentowork|looking for (my next|new) (role|opportunit))\b/, 5],
    ],
    paper: [
      [/\b(paper|preprint|article|stud(y|ies)|journal|proceedings|conference paper|dissertation|thesis|experiments?|replications?)\b/, 2],
      [/\b(pre-?regist\w*|effect sizes?|data and code|open data|replicated|peer[- ]reviewed|meta-analysis)\b/, 3],
      [/\b(published|accepted|forthcoming) (in|at)\b/, 3],
      [/\b(arxiv|ssrn|doi\.org|10\.\d{4,}\/|researchgate|acm|ieee|springer|elsevier|aisel|misq|nature|science)\b/, 4],
      [/\b(we (find|show|propose|study|examine|analy[sz]e)|our (findings|results|data))\b/, 3],
      [/\b(n ?= ?\d+|sample of \d+|regression|survey|interviews)\b/, 2],
    ],
    event: [
      [/\b(workshop|webinar|meetup|conference|summit|panel|hackathon|seminar|tutorial|bootcamp|livestream|live stream|fireside chat|ama|q&a|book launch|town hall)\b/, 3],
      [/\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\bnoon\b|\b(tomorrow|tonight|today) at\b|\b\d{1,2}(:\d{2})?\s?(cet|cest|est|edt|pst|pdt|utc|gmt)\b/, 2],
      [/\b(register|registration|sign ?up|rsvp|join us)\b/, 2],
      [/\b(on|this) (mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b\d{1,2}(st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}\b/, 2],
      [/\b(cfp|call for (papers|proposals|submissions)|deadline)\b/, 3],
    ],
    release: [
      [/\b(we (just )?(launched|released|shipped|open[- ]sourced)|now (live|available)|introducing|announcing|starting today|now you can|new in beta|rolling out|v\d+\.\d+)\b/, 3],
      [/\b(github\.com|gitlab|huggingface|open[- ]source|repo|dataset|api|plugin|extension)\b/, 2],
    ],
    take: [
      [/\b(unpopular opinion|hot take|controversial|overrated|underrated|is dead|is a scam|is a myth|stop (doing|using|saying))\b/, 3],
      [/\b(the (real )?problem with|nobody (wants|needs|cares)|everyone is wrong|you don'?t need|should(n'?t)? be|must stop)\b/, 2],
      [/\b(change my mind|fight me|i said what i said)\b/, 3],
    ],
    insight: [
      [/\b(\d+(\.\d+)?%|\$\d|€\d|\d{2,}(,\d{3})+)\b/, 1],
      [/\b(because|therefore|however|in contrast|the data|evidence|benchmark|measured|tested)\b/, 1],
    ],
  };

  // Roasts: the post's honest inner voice. {role} {org} {thing} are filled if known.
  const ROASTS = {
    job: {
      mild:   ["New job{org}. Congratulations are welcome.", "I changed jobs{org}. That's the post."],
      snarky: ["New job{org}. Please be happy for me.", "I have a new badge{org}. Clap accordingly.", "Changed employers{org}. Wrote an Oscar speech about it."],
      savage: ["New job{org}. 400 words of gratitude for a contract.", "I got hired{org}. Thanking 37 people who did not hire me.", "Same me, new lanyard{org}."],
    },
    brag: {
      mild:   ["I achieved something and want you to know.", "Something good happened to me."],
      snarky: ["I'm awesome. Read this.", "Humbled, which is why I'm telling 10,000 people.", "I won a thing. Pretend you're surprised."],
      savage: ["I'm awesome. The humility is decorative.", "Bragging, but with the word 'humbled' as a fig leaf.", "A trophy, a selfie and a paragraph of 'grateful'."],
    },
    bait: {
      mild:   ["Please comment so more people see this.", "A question designed to get replies."],
      snarky: ["Please comment so the algorithm loves me.", "Agree? (You're supposed to say yes.)", "Engagement farming. Type YES to feed it."],
      savage: ["Bait. You are the fish.", "A comment-harvesting machine wearing a thought.", "Nothing to read here, only something to click."],
    },
    lesson: {
      mild:   ["A normal moment, turned into career advice.", "Personal anecdote, business moral attached."],
      snarky: ["Something mildly normal happened. Here's a B2B lesson.", "My kid said a thing. Now it's a leadership framework.", "A parable, guaranteed to end in a sales funnel."],
      savage: ["A fable with a CTA.", "Life happened; I monetised it.", "Fortune cookie, stretched to a page."],
    },
    broetry: {
      mild:   ["One thought, many line breaks.", "A short idea, spaced out."],
      snarky: ["One thought, stretched over a whole screen.", "Every sentence gets its own paragraph. And a dramatic pause.", "Poetry for people who scroll."],
      savage: ["One sentence. Thirty Enter keys.", "Broetry. Content per line: about a fortune cookie.", "Dramatic. Pause. Nothing. Here."],
    },
    sales: {
      mild:   ["There's something for sale here.", "An offer, wrapped in advice."],
      snarky: ["Buy my thing.", "Free advice, sold separately.", "DM me. It's a funnel."],
      savage: ["It's an ad that didn't pay for itself.", "Buy my thing. The story was the wrapping paper.", "Value bomb. Invoice to follow."],
    },
    hype: {
      mild:   ["AI is changing things, according to this post.", "Enthusiasm about AI, details optional."],
      snarky: ["AI changes everything. Also, I have a course.", "You're falling behind. Here are 7 tools I found yesterday.", "Hype, with a robot emoji."],
      savage: ["ChatGPT wrote this about ChatGPT.", "The future is here and it's a carousel post.", "AI will replace you, unlike this post's insight."],
    },
    listicle: {
      mild:   ["A list of tips.", "Numbered advice."],
      snarky: ["Ten things you already knew, with emoji bullets.", "A list. Each item is a fortune cookie."],
      savage: ["Bullet points cosplaying as wisdom.", "Listicle. Save it, never read it."],
    },
    ad: {
      mild:   ["Someone paid for this spot."],
      snarky: ["Someone paid to be in your feed."],
      savage: ["Paid placement. Scroll with confidence."],
    },
    hiring: {
      mild:   ["We're hiring{role}."],
      snarky: ["We're hiring{role}. The actual info is in here somewhere."],
      savage: ["Job ad{role}. Skip the culture poem, read the link."],
    },
    personal: {
      mild:   ["Personal news. No snark here."],
      snarky: ["Personal news. No snark here."],
      savage: ["Personal news. No snark here."],
    },
    paper: {
      mild:   ["New research{thing}. Could be worth reading."],
      snarky: ["We published a paper{thing}. This one might actually be worth it."],
      savage: ["Actual research{thing}. Rare sighting. Go look."],
    },
    event: {
      mild:   ["There's an event{thing}. Details inside."],
      snarky: ["There's a workshop{thing}. Real info, surprisingly."],
      savage: ["An event{thing}. Useful, despite the emojis."],
    },
    release: {
      mild:   ["Something new was released{thing}."],
      snarky: ["We built a thing{thing}. You can actually try it."],
      savage: ["Shipped something real{thing}. Worth a click."],
    },
    insight: {
      mild:   ["An actual argument, with some substance."],
      snarky: ["Real content. Read it, it's allowed."],
      savage: ["Substance detected. Don't get used to it."],
    },
    plain: {
      mild:   ["A normal post. Carry on.", "Nothing to decode here."],
      snarky: ["A normal post. No spin detected, suspiciously.", "Just words. No agenda found.", "Regular human post. Rare, enjoy it."],
      savage: ["No spin. Rarer than you'd think.", "A post that's just a post. Frame it."],
    },
    take: {
      mild:   ["An opinion."],
      snarky: ["An opinion, delivered with confidence."],
      savage: ["Opinion, confidence level: keynote."],
    },
  };

  // ---------- helpers ----------
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  const pick = (arr, seed) => arr[parseInt(seed, 36) % arr.length];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function cleanText(t) {
    return (t || "")
      .replace(/ /g, " ")
      .replace(/(…|\.\.\.)\s*(see more|more|mehr anzeigen|show more)\s*$/i, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function score(text, patterns) {
    let s = 0;
    for (const [re, w] of patterns) {
      const m = text.match(new RegExp(re.source, "gi"));
      if (m) s += w * Math.min(m.length, 3);
    }
    return s;
  }

  const PAPER_HOSTS = /(doi\.org|arxiv\.org|ssrn\.com|researchgate|aisel\.aisnet|acm\.org|ieee|springer|sciencedirect|tandfonline|wiley|nature\.com|science\.org|jstor|pubsonline\.informs|misq|osf\.io|zenodo|openreview|semanticscholar|scholar\.google)/i;
  const EVENT_HOSTS = /(eventbrite|meetup\.com|lu\.ma|zoom\.us|teams\.microsoft|hopin|\.rsvp\/|\/rsvp|\/events?\/)/i;
  const CODE_HOSTS = /(github\.com|gitlab\.com|huggingface\.co|pypi\.org|npmjs\.com|chromewebstore|addons\.mozilla)/i;
  const JUNK_LINK = /(linkedin\.com\/(in|company|feed\/hashtag|school|showcase)\/|linkedin\.com\/search|\/hashtag\/|x\.com\/[^/]+$|twitter\.com\/[^/]+$|x\.com\/(hashtag|search)|bsky\.app\/(profile|search|hashtag)|^#|^mailto:|^javascript:)/i;

  function hostOf(href) {
    try { return new URL(href).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  // LinkedIn wraps outside links: linkedin.com/redir/redirect?url=<real url>
  function unwrap(href) {
    try {
      const u = new URL(href);
      if (/(^|\.)linkedin\.com$/.test(u.hostname) && /^\/(redir|safety)\//.test(u.pathname) && u.searchParams.get("url")) return u.searchParams.get("url");
    } catch (e) { /* not a URL */ }
    return href;
  }

  function bestLink(links) {
    const cands = [];
    for (let l of links || []) {
      if (l && l.href) l = Object.assign({}, l, { href: unwrap(l.href) });
      if (!l || !l.href || JUNK_LINK.test(l.href)) continue;
      const label = (l.title || l.text || "").trim();
      if (/^[#@]/.test(label)) continue;
      const shown = label || hostOf(l.href);
      let w = 1;
      const probe = l.href + " " + label;
      if (PAPER_HOSTS.test(probe)) w = 5;
      else if (CODE_HOSTS.test(probe)) w = 4;
      else if (EVENT_HOSTS.test(probe)) w = 4;
      if (l.title) w += 1; // link preview card
      cands.push({ href: l.href, title: shown.replace(/^https?:\/\//, "").slice(0, 90), host: hostOf(l.href), weight: w });
    }
    cands.sort((a, b) => b.weight - a.weight);
    return cands[0] || null;
  }

  function sentences(text) {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^[\s\-–•·*>👉✅🔹▪️➡️→\d.)]+/u, "").trim())
      .filter((s) => s.split(/\s+/).length >= 4);
  }

  const FLUFFY_SENTENCE = /\b(thrilled|excited|humbled|honou?red|grateful|blessed|agree\?|thoughts\?|let that sink in|read that again|journey|incredible|amazing|so proud|can'?t wait)\b/i;

  function gistOf(text) {
    const ss = sentences(text);
    if (!ss.length) return "";
    let best = ss[0], bestScore = -99;
    ss.forEach((s, i) => {
      const n = s.split(/\s+/).length;
      let sc = 0;
      if (/\d/.test(s)) sc += 2;
      if (n >= 8 && n <= 32) sc += 2;
      sc += Math.min(3, (s.slice(1).match(/\b[A-Z][a-zA-Z]{2,}/g) || []).length);
      if (/\b(we|our|study|paper|workshop|release|launch|find|show|built|hiring|role|position|join)\b/i.test(s)) sc += 2;
      if (FLUFFY_SENTENCE.test(s)) sc -= 3;
      if (/\?$/.test(s)) sc -= 2;
      if (/#\w/.test(s)) sc -= 1;
      sc -= i * 0.15; // early sentences win ties
      if (sc > bestScore) { bestScore = sc; best = s; }
    });
    const words = best.replace(/#\w+/g, "").replace(/\s+/g, " ").trim().split(" ");
    return words.length > 28 ? words.slice(0, 28).join(" ") + "…" : words.join(" ");
  }

  function extractJob(text) {
    const role = text.match(/\b(?:as|as an?|as the|role of|position of|promoted to)\s+(?:an?\s+|the\s+)?([A-Z][\w&/\- ]{2,48}?)(?=\s+(?:at|@|in|for|with)\b|[.,!\n(]|$)/);
    const org = text.match(/\b(?:at|@|joined|joining)\s+(?:the\s+)?([A-Z][\w&.'\- ]{1,40}?)(?=\s+(?:as|in|and|to|team)\b|[.,!\n(]|$)/);
    return { role: role ? role[1].trim() : "", org: org ? org[1].trim() : "" };
  }

  function quoteTitle(text) {
    const m = text.match(/[“"«]([^"”»\n]{8,120})[”"»]/);
    if (m) return m[1].trim();
    // "workshop: Causal Inference for IS Researchers."
    const e = text.match(/\b(?:workshop|webinar|talk|seminar|tutorial|course|masterclass|session|keynote)\b[^:\n]{0,30}:\s*([A-Z][^.\n!?]{5,80})/i);
    return e ? e[1].trim() : "";
  }

  // ---------- main ----------
  function classify(post, opts) {
    const spice = (opts && opts.spice) || "snarky";
    const text = cleanText(post.text);
    const lower = text.toLowerCase();
    const words = text ? text.split(/\s+/).length : 0;
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const shortLines = lines.filter((l) => l.length < 70).length;
    const emojis = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
    const hashtags = (text.match(/#[\p{L}\d_]+/gu) || []).length;
    const numbered = lines.filter((l) => /^(\d+[.)]|[-–]\s|[👉✅🔹▪️➡️→•✔️❌⚡️🚀💡📌🔥]\s?)/u.test(l)).length;

    const s = {};
    for (const k in P) s[k] = score(lower, P[k]);
    if (lines.length >= 9 && shortLines / lines.length > 0.75 && words / lines.length < 12) s.broetry = 6 + Math.min(4, (lines.length - 9) / 3);
    if (numbered >= 4) s.listicle = 4 + numbered / 2;
    if (post.promoted) s.ad = 20;

    const link = bestLink(post.links);
    if (link && PAPER_HOSTS.test(link.href + link.title)) s.paper += 4;
    if (link && CODE_HOSTS.test(link.href + link.title)) s.release += 3;
    if (link && EVENT_HOSTS.test(link.href + link.title)) s.event += 3;
    // Paper/event vocabulary alone is cheap; demand some evidence before calling it substance.
    if (s.paper < 6) s.paper = 0;
    if (s.event < 5) s.event = 0;
    // A workshop that already happened is a report, not an invitation.
    if (s.event && !/\b(register|registration|sign ?up|rsvp|apply (now|here|by|before|today)|deadline|tickets?|join us|save the date|cfp|call for)\b/i.test(text) &&
        /\b(last (week|weekend|month|year)|yesterday|recently|wrapped up|was (a|an|such)|we had)\b/i.test(text)) s.event = 0;
    if (s.take < 3) s.take = 0;
    if (s.hype < 4) s.hype = 0;
    if (s.insight < 3 || words < 60) s.insight = 0;

    // Choose category: personal hardship always wins; then priority order on ties.
    let category = "plain", best = 2.5;
    const order = ["ad", "personal", "hiring", "paper", "event", "release", "job", "bait", "sales", "brag", "lesson", "hype", "broetry", "listicle", "insight", "take"];
    for (const k of order) {
      if (k === "personal" && s.personal >= 5) { category = "personal"; best = 99; break; }
      const v = k === "bait" ? s[k] / 2 + 1 : s[k];
      if (v > best + 0.01) { best = v; category = k; }
    }
    // Self-promotion that also carries a real paper/event: keep the substance.
    if (["brag", "job", "sales"].includes(category) && (s.paper >= 8 || s.event >= 7)) category = s.paper >= s.event ? "paper" : "event";

    // Signal: how much of this deserves your attention.
    const cat = CATS[category];
    let signal = 50;
    if (cat.substance) signal += 22;
    if (cat.fluff) signal -= 18;
    if (category === "bait") signal -= 15;
    if (category === "ad") signal -= 20;
    if (link) signal += cat.fluff ? 3 : 10;
    if (/\d/.test(text)) signal += 3;
    signal -= Math.min(12, Math.max(0, emojis - 4) * 1.5);
    signal -= Math.min(10, Math.max(0, hashtags - 3) * 2);
    signal -= s.bait * 1.5;
    signal += Math.min(10, s.insight * 1.5);
    if (words > 250 && cat.fluff) signal -= 6;
    signal = Math.round(clamp(signal, 3, 97));

    // Fill the roast.
    const seed = hash(text);
    const job = category === "job" || category === "hiring" ? extractJob(text) : { role: "", org: "" };
    const quoted = quoteTitle(text);
    const urlish = (t) => !t || (!/\s/.test(t) && /[./]/.test(t));
    if (link && quoted && urlish(link.title) && (cat.substance || category === "release")) link.title = quoted;
    const title = quoted || (link && !urlish(link.title) && link.title.length <= 50 ? link.title : "");
    const roast = pick(ROASTS[category][spice] || ROASTS[category].snarky, seed)
      .replace("{org}", job.org ? " at " + job.org : "")
      .replace("{role}", job.role ? ": " + job.role : "")
      .replace("{thing}", title ? ": ‘" + title.slice(0, 60) + (title.length > 60 ? "…" : "") + "’" : "");

    let worth = null;
    if (link && (!cat.fluff || cat.substance)) worth = { href: link.href, title: link.title, host: link.host };
    else if (link && category === "job") worth = null;
    else if (link && link.weight >= 4) worth = { href: link.href, title: link.title, host: link.host };

    return {
      category,
      label: cat.label,
      emoji: cat.emoji,
      kind: !!cat.kind,
      roast,
      gist: gistOf(text),
      signal,
      worth,
      words,
      minutes: Math.max(0.1, words / 230),
      engine: "local",
      hash: seed,
      scores: s,
    };
  }

  root.Unspin = root.Unspin || {};
  root.Unspin.classify = classify;
  root.Unspin.CATS = CATS;
  root.Unspin.hash = hash;
  root.Unspin.cleanText = cleanText;
  root.Unspin.bestLink = bestLink;
})(typeof globalThis !== "undefined" ? globalThis : this);
