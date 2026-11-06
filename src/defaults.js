/* Shared defaults for every part of ForReal (content, popup, options, background). */
globalThis.UNSPIN_DEFAULTS = {
  enabled: true,
  engine: "auto", // auto = rules + Chrome on-device AI if present | local = rules only | anthropic | openrouter | ollama
  spice: "snarky", // mild | snarky | savage
  collapse: "skips", // skips = fold only certain junk (ads, bait, signal < 25) | maybe = fold all but Worth it | never
  threshold: 40, // a post is a Skip below this signal (Worth it from 65)
  jokes: true, // show the translation line on Maybe and Skip posts
  showPlain: false, // also put a line on ordinary posts with nothing to say
  minWords: 15,
  sites: { linkedin: true, x: true, bsky: true },
  models: {
    anthropic: "claude-opus-5-5",
    openrouter: "anthropic/claude-haiku-5.5",
    ollama: "qwen3:8b",
  },
  ollamaUrl: "http://localhost:11434",
};

globalThis.unspinSettings = async function () {
  const api = globalThis.browser || globalThis.chrome;
  const D = globalThis.UNSPIN_DEFAULTS;
  const s = (await api.storage.sync.get(null)) || {};
  return Object.assign({}, D, s, {
    models: Object.assign({}, D.models, s.models),
    sites: Object.assign({}, D.sites, s.sites),
  });
};
