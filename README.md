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

| Engine | Cost | Privacy | Notes |
|---|---|---|---|
| **Local** (default) | free | nothing leaves the browser | pattern-based, English and some German |
| **Claude** (Anthropic API) | your key; about $0.008 per post on Opus 5.5, $0.0002 on Haiku 5.5 | post text goes to Anthropic | sharpest lines, any language |
| **OpenRouter** | your key | post text goes to OpenRouter | any model id |
| **Ollama** | free | stays on your computer | start with `OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*" ollama serve` |

AI calls are made only for posts near the viewport, at most three at a time, and cached (800 entries). The local
verdict shows instantly and is replaced when the AI answers. URLs the model returns are kept only if they appear in the
post. Keys are kept in the extension's local storage on this device and sent only to the chosen provider.

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
- The adapters were tested on a demo feed with the sites' markup, not yet on the live sites.
- The local decoder is English-first; use an AI engine for other languages.
- Mobile: Firefox for Android and Safari on iOS (via the converter) can run it; the mobile apps cannot.
