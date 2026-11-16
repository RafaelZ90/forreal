# Privacy practices: purpose and permissions

## Single purpose

ForReal labels the posts in a person's LinkedIn, X and Bluesky feed with a one-line verdict (worth it, maybe or skip,
plus the genre and the link to the paper, event, tool or job the post is about) and folds ads and engagement bait,
so the reader can decide quickly which posts deserve their time.

## Permission justifications

**storage**
Saves the reader's settings (which sites, how much to fold, joke tone), the reader's label corrections, a daily count
for the toolbar report, and, only when the reader connects their own AI provider, that provider's API key and a cache
of its answers. Everything stays in the browser's local or sync storage.

**Host permission: https://www.linkedin.com/\*, https://x.com/\*, https://twitter.com/\*, https://bsky.app/\***
The content script must read the posts on these feed pages to judge them and must add the one-line verdict above each
post. It runs only on these four sites and does not read any other page.

**Optional host permissions: https://api.anthropic.com/\*, https://openrouter.ai/\*, http://localhost/\*, http://127.0.0.1/\***
Requested only when the reader chooses "use your own AI provider" in the settings, at that moment, for that provider.
They let the background worker call the provider the reader picked, with the reader's own key (Anthropic or
OpenRouter), or a model server on the reader's own computer (Ollama on localhost). Not requested by default.

**No other permissions.** No tabs, history, cookies, scripting, webRequest or offscreen document.

## Remote code

No, I am not using remote code. All JavaScript ships in the package. No `eval`, no `new Function`, no remote scripts,
no HTML from posts or models (everything is drawn with `textContent`). AI providers, when the reader enables one, return
JSON data (a genre, a score and two short lines) that is validated and clipped; it is never executed.
