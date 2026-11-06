# Unspin – the feed decoder

A browser extension that decodes LinkedIn, X and Bluesky posts into one honest line, folds away the fluff, and points
you to what is actually worth your attention.

> **Jordan Pierce** · 💼 New job · signal 29
> “New job at Northwind Labs. Please be happy for me.”
> ▸ Read the original (98 words) · ≈ 26 s of your life saved

> **Dr. Amara Okafor** · 📄 Research · signal 85
> “We published a paper: ‘Decision Problems in DAO Governance’. This one might actually be worth it.”
> **→ Worth your time** Decision Problems in DAO Governance · papers.ssrn.com

The site keeps looking like itself. The card is drawn in the site's own fonts, radii and light/dark colours, inside a
shadow root so neither side's CSS leaks.

## What it does

- **Decodes every post** into a category (new job, humblebrag, engagement bait, fake life lesson, broetry, sales pitch,
  AI hype, listicle, ad, hiring, personal, research, event, launch, actual insight, hot take), a one-line roast and a
  one-line gist of what the post actually says. The post itself is blurred behind them; one click shows it.
- **Scores the signal** from 0 to 100. Posts below your threshold get their text folded away, and the worst ones are
  faded out. One click brings the original back.
- **Points to the real thing:** a paper, workshop, tool, dataset or job link gets a green *→ Worth your time* button.
- **Never roasts hardship:** grief, illness and lay-offs get a plain, kind line at every spice level.
- **Spice levels:** mild, snarky, savage.
- **Daily spin report** in the toolbar popup: posts decoded, minutes saved, share of pure fluff, top genres.

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
src/content/overlay.js     the card (shadow DOM, per-site themes)
src/content/main.js        finds posts, mounts cards, folds/dims, asks the AI near the viewport
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
