# ForReal – working notes for Claude

A browser extension (Manifest V3; Chrome first, Firefox and Safari builds) that puts one line on every LinkedIn, X and
Bluesky post: ✅ Worth it / 🟡 Maybe / ⛔ Skip, plus the genre, and folds away certain junk. Built for one user (the repo
owner) and possibly shared later via the Chrome Web Store.

## The owner's goals (keep these)

1. **The main signal is "is this worth my time?"** Point to the real thing (paper, workshop, tool, dataset, job) with a
   link in the line. Jokes ("I'm awesome. Read this.") are optional fun, never the point, and can be switched off.
2. **Never hide what the reader might want.** Fold only when certain: ads (always), engagement bait, or signal < 15,
   and never a post with a worth link, never a personal post (grief, illness, layoff). Other skips keep their label and
   stay open. A folded post always shows one sentence of what it was about, so the reader can decide to open it.
3. **The site must still look like itself.** The line is slim and integrated: LinkedIn a quiet one-liner; on X and
   Bluesky a "context line" aligned with the name column (no box, no border, no "HTML-y" look). On Bluesky the line sits
   on top of its post, inside its bordered block. The page should get shorter, not longer. Ordinary posts get no line
   (setting "showPlain" to opt in).
4. **Free and hard-coded:** no hosting, no AI costs for anyone. Rules decide genre, score and link; Chrome's on-device
   AI (Prompt API) only re-words the two lines when present. Own-provider engines (Claude, OpenRouter, Ollama) are an
   Advanced opt-in with the user's own key.
5. **No flicker, no jumping.** The automatic fold is decided once per post; the reader's Show/Fold click wins; the text is
   read rendering-independently (`readText` DOM walk on the text box without the "…more" button), never `innerText`.
6. Concise UI; English by default.

## Layout

- `src/content/policy.js` – `tierOf`, `autoFold`, `mergeAI` (AI answers held to the rules); pure, tested.
- `src/content/classifier.js` – rules: categories (`CATS`), weighted regex patterns, signal 0–100, roasts per spice,
  gist, `bestLink`, `safeUrl`, `relabel`, 53-bit `hash`.
- `src/content/sites.js` – site adapters (LinkedIn 2026 markup: `[role=listitem][componentkey^=update-card-focus]`,
  `[data-testid=expandable-text-box]`; X `data-testid`s; Bluesky with mount inside the bordered block), `readText`.
- `src/content/overlay.js` – the line (shadow DOM, per-site themes, about-line for folded posts, details panel with
  "Wrong label?").
- `src/content/main.js` – scanning (MutationObserver throttled to 200 ms, burst rescans, URL watch), fold logic
  (`autoFold`, `userFold`), AI merge held to the rules, corrections via the background.
- `src/background.js` – engines, queue, cache (800), daily AI cap, corrections/overrides store, stats, message checks.
- `src/ai-chrome.js` – Chrome Prompt API, used only where the background worker exposes `LanguageModel` (no offscreen
  document since 0.3.0; otherwise the rules write the lines).
- `src/options/`, `src/popup/` – settings and toolbar popup.
- `build.py` → `dist/chrome`, `dist/firefox`, zips. `--desktop` refreshes `~/Desktop/ForReal` (the owner's unpacked
  install) only if it already holds a ForReal build.
- `npm test` (Node 20+, `test/node/*.test.mjs`, Playwright for the browser parts): fixtures via `test/checks.js`
  (`expect`, `expect_not`, `expect_tier`, `expect_fold`, `expect_no_fold`, `expect_host`, `expect_no_link`), security
  rules, background message checks, adapters on invented markup, demo self-test, speed budget, build. CI:
  `.github/workflows/test.yml`. `npm run store:assets` re-makes `store/` images from the demo feed.
- `test/run.html` (the same fixtures and checks as a table: demo posts, `fixtures/*.json`),
  `test/demo.html?selftest` (made-up feeds running the real content scripts; Show/Fold must stay put),
  `tools/devserver.py` (port 8766, no-store). Serve the repo root and open those pages.

## Rules for working here

- **Fixtures are invented or paraphrased.** Never commit real people's posts, names or feed content.
- **Security invariants (0.2.5 review; tested in `test/node/security.test.mjs` and `background.test.mjs`):** only `textContent` rendering; links in the line only `http(s)` and only from
  the post's own links (`safeUrl`); model output is data: it may not turn an ad into a non-ad (or a post into an ad), overrule a personal post, move the score by more
  than 25, or supply its own link; `storage.local` (API keys) is `TRUSTED_CONTEXTS` – content scripts go through the
  background; the background ignores messages from other extensions and paid test calls from tabs; Ollama localhost only.
- Every behaviour change gets a regression fixture or selftest check.
- Bump `manifest.json` version on each user-visible change (each line carries it as `data-forreal`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Known open items (as of 0.3.0)

- Live tests can only be done in the owner's Chrome; cloud sessions cannot see LinkedIn/X. Verify against the demo feed
  and fixtures, and list what needs a live check.
- The 0.3.0 adapter changes (no `innerText`, card titles, fallbacks) are tested on invented markup only: check live.
- Chrome's on-device AI now runs only where the service worker exposes `LanguageModel`. Whether the owner's Chrome does
  is unverified (the settings page says "does not offer it to extensions in the background" if not). Never start the
  multi-GB model download without the owner's OK.
- Store: `store/` holds the kit. Open: a public URL for PRIVACY.md, and whether the store build keeps the Advanced
  engines (decides the data disclosure, see `store/data-disclosure.md`).
- Firefox: content scripts can read `storage.local` (no access-level switch); builds are checked by `npm test` but untested
  by hand.
- Rules are English and German. Misclassifications seen live so far were all fixed with fixtures.
- The node on the owner's Mac is v6: `npm test` needs Node 20+ (CI runs it on every push).
