// Answers {target: "offscreen-ai"} messages from the background worker.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen-ai") return false;
  const ai = globalThis.UnspinChromeAI;
  const job = msg.op === "status" ? ai.status() : ai.decode(msg.post, msg.hint, msg.spice);
  job.then((r) => sendResponse({ ok: true, r }), (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
  return true;
});
