# ForReal – is this post worth your time?

A browser extension for LinkedIn, X and Bluesky. Every post gets one line at the top:

> ✅ **Worth it** · Research · Decision Problems in DAO Governance  `→ papers.ssrn.com`
>
> 🟡 **Maybe** · Hot take · *An opinion, delivered with confidence.*
>
> ⛔ **Skip** · Humblebrag · *I'm awesome. Read this.*  `Show post`

Skipped posts fold down to that one line, text and pictures included, so the feed gets shorter, not longer (the demo
feed: 7,254 px → 4,120 px). Worth-it posts stay open with the link up front. Click a line for what the post actually
says, the joke, the score, and "Wrong label?".

## What it does

- **Verdict:** a signal score 0–100 becomes ✅ Worth it (65+), 🟡 Maybe, or ⛔ Skip (below 40, adjustable).
- **Genre:** new job, humblebrag, engagement bait, fake life lesson, broetry, sales pitch, AI hype, listicle, ad,
  hiring, personal, research, event, launch, actual insight, hot take, plain post.
- **Points to the real thing:** a paper, workshop, tool or dataset link sits right in the line (LinkedIn's redirect
  links are unwrapped).
- **Jokes:** the honest translation of the post (mild / snarky / savage), on Maybe and Skip lines; can be switched off.
  Grief, illness and lay-offs are never joked about and never folded.
- **Fold:** skips (default), everything except worth-it, or nothing.
- **Corrections:** "Wrong label?" re-labels the post, remembers it, and keeps the example locally; the settings page
  copies them for tuning the rules.
- **Daily report** in the toolbar popup: posts judged, minutes saved, share skipped, top genres.

## Engines

Free by default, no keys, no hosting, nothing leaves the computer.

| Engine | What writes the two lines | Where it works |
|---|---|---|
| **Automatic** (default) | Chrome's built-in on-device AI (Gemini Nano, Prompt API) when this computer has it; otherwise ForReal's rules | AI part: Chrome 138+ on a capable computer. Everywhere else: rules |
| **Rules only** | ForReal's rules (genre phrases, templates per genre, most informative sentence) | every browser |
| Advanced: Claude / OpenRouter / Ollama | your own provider and key; post text goes to that provider | every browser |

In every engine the rules decide the genre, the signal score and the "worth your time" link; the on-device AI only
writes the roast and the one-sentence gist, one post at a time, cached. If the model is missing, still downloading or
fails, the card keeps the rules' lines. Chrome downloads the model once (a few GB); the settings page has a button for it.
The model runs in the background worker when Chrome exposes it there, otherwise in a hidden offscreen page.

## Install (developer mode)

```bash
python3 build.py
```

- **Chrome / Edge / Brave / Arc:** open `chrome://extensions`, switch on *Developer mode*, *Load unpacked*, and pick `dist/chrome`.
- **Firefox (121+):** open `about:debugging#/runtime/this-firefox`, *Load Temporary Add-on*, and pick
  `dist/firefox/manifest.json`. Then click the toolbar icon and press *Allow* (Firefox asks for site access separately).
- **Safari:** `xcrun safari-web-extension-converter dist/chrome` (needs Xcode).
- **Store builds:** `dist/forreal-chrome.zip` (Chrome Web Store, Edge Add-ons) and `dist/forreal-firefox.zip` (AMO).

## Develop

```
src/defaults.js            shared settings
src/background.js          AI providers, queue, cache, stats (service worker / Firefox event page)
src/content/classifier.js  local decoder: categories, roasts, signal, gist, best link
src/content/sites.js       site adapters (LinkedIn, X, Bluesky): post, text, author, links, ads
src/content/overlay.js     the verdict line (shadow DOM, per-site themes)
src/content/main.js        finds posts, adds the line, folds skips, asks the AI near the viewport
src/popup/, src/options/   toolbar popup and settings page
test/demo.html             made-up LinkedIn- and X-style feed that runs the real content scripts
```

Run the demo without installing anything:

```bash
python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765/test/demo.html> (add `?spice=savage` or `?collapse=never`) and <http://127.0.0.1:8765/test/run.html> for the classifier checks (demo posts plus invented Bluesky-style posts).
`python3 test/make_previews.py` writes preview pages for the popup and settings page.

## Security and privacy

- **Nothing leaves the computer** with the default engines (Automatic, Rules only). With your own provider, the text of
  posts near the screen (up to 6,000 characters, the author's name and up to eight links) goes to that provider only;
  at most 300 calls a day by default (adjustable), Claude Haiku by default.
- **No remote code, no eval, no HTML from posts or models:** everything is drawn with `textContent` in a shadow DOM.
  Links in the verdict line are only ever `http(s)` links that were in the post itself (LinkedIn redirects unwrapped,
  `javascript:`/`data:` dropped); a model can re-word and re-label a post, but cannot make an ad not an ad, move the score
  by more than 25 points, or bring its own link.
- **API keys** stay in `storage.local`, which Chrome closes to content scripts (`TRUSTED_CONTEXTS`); the feed pages never
  see them. Firefox has no such switch. The background worker answers only the extension's own scripts; paid test calls
  and cache clearing only from its own pages.
- **Other people's posts** are kept only on your device: up to 800 AI lines in a cache, and up to 300 correction
  examples for 30 days (they include the post's text; share them with care).
- Permissions: `storage`, `offscreen` (Chrome's on-device model) and the four feed sites; provider hosts are asked for
  only when you choose that provider. See [PRIVACY.md](PRIVACY.md).

## Known limits

- LinkedIn and X change their markup often. The adapters try several selectors and fall back to the largest text
  block, but expect to adjust `sites.js` now and then. Tested live on LinkedIn, X and Bluesky in November 2026.
- The rules are English-first (German ad labels are known); use an AI engine for other languages.
- Not in any store yet: load it unpacked. Firefox and Safari builds are made but have not been tested by hand.
- Mobile: Firefox for Android and Safari on iOS (via the converter) can run it; the mobile apps cannot.
