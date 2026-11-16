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
  $("jokes").checked = s.jokes !== false;
  $("jokes").onchange = (e) => api.storage.sync.set({ jokes: e.target.checked });
  $("engine").textContent = ENGINES[s.engine] || s.engine;

  const { stats } = await api.storage.local.get("stats");
  const today = new Date().toISOString().slice(0, 10);
  const st = stats && stats.day === today ? stats : { posts: 0, minutes: 0, fluff: 0, worth: 0, cats: {} };
  $("s-posts").textContent = st.posts;
  $("s-min").textContent = st.minutes < 10 ? st.minutes.toFixed(1) : Math.round(st.minutes);
  $("s-fluff").textContent = st.posts ? Math.round((100 * st.fluff) / st.posts) + "%" : "–";
  $("worth-line").textContent = st.worth ? "✅ " + st.worth + (st.worth === 1 ? " post" : " posts") + " today worth your time." : "";

  const bars = $("bars");
  bars.textContent = "";
  const top = Object.entries(st.cats || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Open LinkedIn, X or Bluesky and scroll. Today's report appears here.";
    bars.appendChild(p);
  }
  const max = top.length ? top[0][1] : 1;
  for (const [cat, n] of top) {
    const row = document.createElement("div");
    row.className = "bar";
    const mk = (cls, text) => { const e = document.createElement("span"); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const track = mk("track"), fill = mk("fill");
    fill.style.width = Math.max(6, (100 * n) / max) + "%";
    track.appendChild(fill);
    row.append(mk("", LABELS[cat] || cat), track, mk("n", String(n)));
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

// What ForReal found on the open tab. A feed page with no posts usually means the site changed its markup.
async function pageLine() {
  if (!api.tabs || !api.tabs.query) return;
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const r = await api.tabs.sendMessage(tab.id, { type: "pageStatus" });
    if (!r || !r.site) return;
    const line = $("page-line");
    line.hidden = false;
    if (!r.enabled) line.textContent = "ForReal is off for this site.";
    else if (r.posts) line.textContent = "This page: " + r.posts + (r.posts === 1 ? " post" : " posts") + " judged, " + r.folded + " folded.";
    else if (r.age > 8000) {
      line.classList.add("warn");
      line.textContent = "No posts found on this page. If it is a feed, " + r.site + " may have changed its layout; please report it.";
    } else line.hidden = true;
  } catch (e) { /* not a feed tab: no content script there */ }
}

$("open-options").onclick = (e) => { e.preventDefault(); api.runtime.openOptionsPage(); };
render();
pageLine();
