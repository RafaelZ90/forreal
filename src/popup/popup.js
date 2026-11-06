const api = globalThis.browser || globalThis.chrome;
const $ = (id) => document.getElementById(id);
const LABELS = {
  job: "💼 New job", brag: "🏆 Humblebrag", bait: "🎣 Bait", lesson: "🧘 Life lesson", broetry: "🎭 Broetry",
  sales: "💸 Sales pitch", hype: "🤖 AI hype", listicle: "📋 Listicle", ad: "📣 Ad", hiring: "🧲 Hiring",
  personal: "🤍 Personal", paper: "📄 Research", event: "🎤 Event", release: "🛠️ Launch", insight: "💡 Insight", take: "🌶️ Hot take", plain: "💬 Plain post",
};
const ENGINES = { auto: "Rules + on-device AI · nothing leaves your computer", local: "Rules only · nothing leaves your browser", anthropic: "✨ Claude (Anthropic API)", openrouter: "✨ OpenRouter", ollama: "✨ Ollama on this computer" };
const FEED_ORIGINS = ["https://www.linkedin.com/*", "https://x.com/*", "https://twitter.com/*", "https://bsky.app/*"];

function seg(id, value, onPick) {
  const box = $(id);
  box.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.v === value);
    b.onclick = () => { box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); onPick(b.dataset.v); };
  });
}

async function render() {
  const s = await globalThis.unspinSettings();
  $("enabled").checked = s.enabled;
  $("enabled").onchange = (e) => api.storage.sync.set({ enabled: e.target.checked });
  seg("spice", s.spice, (v) => api.storage.sync.set({ spice: v }));
  seg("collapse", s.collapse, (v) => api.storage.sync.set({ collapse: v }));
  $("engine").textContent = ENGINES[s.engine] || s.engine;

  const { stats } = await api.storage.local.get("stats");
  const today = new Date().toISOString().slice(0, 10);
  const st = stats && stats.day === today ? stats : { posts: 0, minutes: 0, fluff: 0, worth: 0, cats: {} };
  $("s-posts").textContent = st.posts;
  $("s-min").textContent = st.minutes < 10 ? st.minutes.toFixed(1) : Math.round(st.minutes);
  $("s-fluff").textContent = st.posts ? Math.round((100 * st.fluff) / st.posts) + "%" : "–";
  $("worth-line").textContent = st.worth ? "→ " + st.worth + (st.worth === 1 ? " post" : " posts") + " today pointed to something worth your time." : "";

  const bars = $("bars");
  bars.textContent = "";
  const top = Object.entries(st.cats || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Open LinkedIn, X or Bluesky and scroll. Today's spin report appears here.";
    bars.appendChild(p);
  }
  const max = top.length ? top[0][1] : 1;
  for (const [cat, n] of top) {
    const row = document.createElement("div");
    row.className = "bar";
    row.innerHTML = '<span></span><span class="track"><span class="fill"></span></span><span class="n"></span>';
    row.children[0].textContent = LABELS[cat] || cat;
    row.querySelector(".fill").style.width = Math.max(6, (100 * n) / max) + "%";
    row.children[2].textContent = n;
    bars.appendChild(row);
  }

  // Firefox treats host permissions as optional: ask once.
  if (api.permissions && api.permissions.contains) {
    const ok = await api.permissions.contains({ origins: FEED_ORIGINS });
    $("perm").hidden = ok;
    $("grant").onclick = async () => {
      const granted = await api.permissions.request({ origins: FEED_ORIGINS });
      $("perm").hidden = granted;
    };
  }
}

$("open-options").onclick = (e) => { e.preventDefault(); api.runtime.openOptionsPage(); };
render();
