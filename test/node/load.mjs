// Loads the extension's plain scripts into a fresh V8 context, the way the browser would load them in order.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
export const readJSON = (rel) => JSON.parse(read(rel));

export function load(files, extra = {}) {
  const ctx = vm.createContext(Object.assign({ console, URL, URLSearchParams, setTimeout, clearTimeout }, extra));
  vm.runInContext("globalThis.window = globalThis; globalThis.self = globalThis;", ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

export const loadRules = () => load(["src/content/classifier.js", "src/content/policy.js", "test/checks.js", "test/fixtures/demo-posts.js"]);

export const FIXTURE_FILES = ["test/fixtures/bsky-style.json", "test/fixtures/regressions.json", "test/fixtures/worth-it.json", "test/fixtures/junk.json", "test/fixtures/german.json"];
