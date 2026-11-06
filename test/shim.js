/* Stand-in for the extension APIs so the content scripts run on a plain page (demo + tests). */
(function () {
  const listeners = [];
  const mk = (area) => {
    const data = {};
    return {
      _data: data,
      get: async (keys) => {
        if (keys == null) return Object.assign({}, data);
        const ks = Array.isArray(keys) ? keys : [keys];
        const o = {};
        ks.forEach((k) => { if (k in data) o[k] = data[k]; });
        return o;
      },
      set: async (obj) => {
        const changes = {};
        for (const k in obj) { changes[k] = { oldValue: data[k], newValue: obj[k] }; data[k] = obj[k]; }
        listeners.forEach((l) => l(changes, area));
      },
      remove: async (k) => { delete data[k]; },
    };
  };
  const sync = mk("sync");
  const local = mk("local");
  const params = new URLSearchParams(location.search);
  if (params.get("spice")) sync._data.spice = params.get("spice");
  if (params.get("collapse")) sync._data.collapse = params.get("collapse");
  globalThis.chrome = {
    storage: { sync, local, onChanged: { addListener: (f) => listeners.push(f) } },
    runtime: {
      sendMessage: async (msg) => {
        if (msg.type === "analyze") return { skip: true };
        if (msg.type === "stats") {
          const st = local._data.stats || { posts: 0, words: 0, minutes: 0, fluff: 0, worth: 0, cats: {} };
          st.posts++; st.words += msg.data.words; if (msg.data.collapsed) st.minutes += msg.data.minutes;
          if (msg.data.fluff) st.fluff++; if (msg.data.worth) st.worth++;
          st.cats[msg.data.category] = (st.cats[msg.data.category] || 0) + 1;
          local._data.stats = st;
          return { ok: true };
        }
        return {};
      },
    },
  };
})();
