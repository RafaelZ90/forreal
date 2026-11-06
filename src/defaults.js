/* Shared defaults for every part of Unspin (content, popup, options, background). */
globalThis.UNSPIN_DEFAULTS = {
  enabled: true,
  engine: "auto", // auto = rules + Chrome on-device AI if present | local = rules only | anthropic | openrouter | ollama
  spice: "snarky", // mild | snarky | savage
  collapse: "all", // all = blur every decoded post | fluff = only low-signal ones | never
  threshold: 45, // posts below this signal get collapsed / dimmed
  dim: true,
  showGist: true,
  minWords: 30,
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
