// Shared by the browser tests: a no-store static server for the repo and a Playwright Chromium.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { ROOT } from "./load.mjs";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

export function serve() {
  const server = http.createServer((req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: "http://127.0.0.1:" + server.address().port })));
}

// Playwright from the project (npm ci) or, on a dev machine, a global install.
export function playwright() {
  const req = createRequire(import.meta.url);
  try { return req("playwright"); } catch (e) { /* not installed locally */ }
  try { return req(path.join(execSync("npm root -g").toString().trim(), "playwright")); } catch (e) { return null; }
}

export async function launch() {
  const pw = playwright();
  if (!pw) return null;
  return pw.chromium.launch();
}
