const api = globalThis.browser || globalThis.chrome;
const $ = (id) => document.getElementById(id);
const ORIGINS = {
  anthropic: ["https://api.anthropic.com/*"],
  openrouter: ["https://openrouter.ai/*"],
  ollama: ["http://localhost/*", "http://127.0.0.1/*"],
};

let flashTimer;
function flash() {
  const s = $("saved");
  s.classList.add("show");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => s.classList.remove("show"), 1100);
}
const save = (obj) => api.storage.sync.set(obj).then(flash);

function seg(id, value, onPick) {
  const box = $(id);
  box.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.v === value);
    b.onclick = () => { box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); onPick(b.dataset.v); };
  });
}

function showProvider(engine) {
  document.querySelectorAll(".provider").forEach((p) => p.classList.toggle("on", p.dataset.for === engine));
  $("test-row").style.display = engine === "local" ? "none" : "flex";
}

async function init() {
  const s = await globalThis.unspinSettings();
  const local = await api.storage.local.get(["anthropicKey", "openrouterKey"]);

  document.querySelectorAll("input[name=engine]").forEach((r) => {
    r.checked = r.value === s.engine;
    r.onchange = async () => {
      // Ask for the provider's host only when it is chosen (a user gesture).
      if (ORIGINS[r.value] && api.permissions) {
        try { await api.permissions.request({ origins: ORIGINS[r.value] }); } catch (e) { /* not fatal: CORS still allows the call */ }
      }
      showProvider(r.value);
      save({ engine: r.value });
    };
  });
  showProvider(s.engine);

  $("anthropicKey").value = local.anthropicKey || "";
  $("openrouterKey").value = local.openrouterKey || "";
  ["anthropicKey", "openrouterKey"].forEach((k) => {
    $(k).onchange = () => api.storage.local.set({ [k]: $(k).value.trim() }).then(flash);
  });

  for (const p of ["anthropic", "openrouter", "ollama"]) {
    const el = $("model-" + p);
    el.value = s.models[p];
    el.onchange = () => save({ models: Object.assign({}, s.models, { [p]: el.value.trim() || globalThis.UNSPIN_DEFAULTS.models[p] }) }).then(() => (s.models[p] = el.value.trim()));
  }
  $("ollamaUrl").value = s.ollamaUrl;
  $("ollamaUrl").onchange = () => save({ ollamaUrl: $("ollamaUrl").value.trim() || globalThis.UNSPIN_DEFAULTS.ollamaUrl });

  seg("spice", s.spice, (v) => save({ spice: v }));
  seg("collapse", s.collapse, (v) => save({ collapse: v }));

  $("threshold").value = s.threshold;
  $("th-val").textContent = s.threshold;
  $("threshold").oninput = () => ($("th-val").textContent = $("threshold").value);
  $("threshold").onchange = () => save({ threshold: Number($("threshold").value) });
  $("minWords").value = s.minWords;
  $("mw-val").textContent = s.minWords;
  $("minWords").oninput = () => ($("mw-val").textContent = $("minWords").value);
  $("minWords").onchange = () => save({ minWords: Number($("minWords").value) });

  ["dim", "showGist"].forEach((k) => {
    $(k).checked = !!s[k];
    $(k).onchange = () => save({ [k]: $(k).checked });
  });
  document.querySelectorAll("[data-site]").forEach((c) => {
    c.checked = s.sites[c.dataset.site] !== false;
    c.onchange = () => {
      s.sites[c.dataset.site] = c.checked;
      save({ sites: Object.assign({}, s.sites) });
    };
  });

  $("test").onclick = async () => {
    const out = $("test-out");
    out.className = "hint";
    out.textContent = "Asking…";
    const r = await api.runtime.sendMessage({ type: "test" });
    if (r && r.ok) { out.className = "hint ok"; out.textContent = "Works: “" + r.sample.roast + "” (signal " + r.sample.signal + ")"; }
    else { out.className = "hint bad"; out.textContent = (r && r.error) || "No answer."; }
  };
  $("clear").onclick = async () => { await api.runtime.sendMessage({ type: "clearCache" }); $("house-out").textContent = "Cache cleared."; };
  $("reset-stats").onclick = async () => { await api.storage.local.remove("stats"); $("house-out").textContent = "Stats reset."; };
}
init();
