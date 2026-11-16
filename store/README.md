# Chrome Web Store kit

Everything the Chrome Web Store dashboard asks for, ready to paste. All images are made from the invented demo feed
(`test/demo.html`), never from real people's posts: `npm run store:assets` re-creates them.

| Dashboard field | Where |
|---|---|
| Package | `python3 build.py` → `dist/forreal-chrome.zip` (also attached to every CI run) |
| Store listing: description, category, language | [listing.md](listing.md) |
| Store icon 128×128 | `icons/icon128.png` |
| Screenshots 1280×800 (up to 5) | `screenshots/1-linkedin.png` … `5-details.png` (`6-popup-settings.png` is a spare) |
| Small promo tile 440×280 | `promo-440x280.png` |
| Privacy practices: single purpose, permission justifications, remote code | [permissions.md](permissions.md) |
| Privacy practices: data usage disclosure and certifications | [data-disclosure.md](data-disclosure.md) |
| Privacy policy URL | `PRIVACY.md` must be reachable at a public URL (see below) |

## Before submitting (owner)

1. **Privacy policy URL.** The store needs a public link. If this repository is private, publish `PRIVACY.md` (GitHub
   Pages, a public gist, or a page on your site) and paste that URL.
2. **Decide on the Advanced engines.** With Claude / OpenRouter / Ollama in the build, the data disclosure must declare
   "Website content" and "Authentication information" (see [data-disclosure.md](data-disclosure.md)). Without them,
   nothing is declared. Both are honest; the first is what the code does today.
3. **Offscreen is gone** (0.3.0): the manifest asks only for `storage` and the four feed sites. Nothing to justify there.
4. Load `dist/chrome` once by hand and click through the live checks in the pull request before uploading.
5. Trader/non-trader status, contact e-mail and the developer account fee are account settings, not in this kit.
