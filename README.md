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
| **Automatic** (default) | Chrome's built-in on-device AI (Gemini Nano, Prompt API) when this computer has it; otherwise Unspin's rules | AI part: Chrome 138+ on a capable computer. Everywhere else: rules |
| **Rules only** | Unspin's rules (genre phrases, templates per genre, most informative sentence) | every browser |
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
- **Store builds:** `dist/unspin-chrome.zip` (Chrome Web Store, Edge Add-ons) and `dist/unspin-firefox.zip` (AMO).

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

Then open <http://127.0.0.1:8765/test/demo.html> (add `?spice=savage` or `?collapse=never`) and <http://127.0.0.1:8765/test/run.html> for the classifier checks (demo posts plus real Bluesky posts).
`python3 test/make_previews.py` writes preview pages for the popup and settings page.

## Known limits of this first draft

- LinkedIn and X change their markup often. The adapters try several selectors and fall back to the largest text
  block, but expect to adjust `sites.js` now and then.
- Tested live on 2026-11-06: LinkedIn (new feed markup: `[role=listitem][componentkey^=update-card-focus]`,
  `[data-testid=expandable-text-box]`) and Bluesky, by injecting the content scripts into the page. X not yet.
- The local decoder is English-first; use an AI engine for other languages.
- Mobile: Firefox for Android and Safari on iOS (via the converter) can run it; the mobile apps cannot.
