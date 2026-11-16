// build.py: both packages are complete and consistent with the demo page and the live bundle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, read, readJSON } from "./load.mjs";

test("build.py makes complete Chrome and Firefox packages", () => {
  execFileSync("python3", [path.join(ROOT, "build.py")], { cwd: ROOT });
  for (const target of ["chrome", "firefox"]) {
    const dir = path.join(ROOT, "dist", target);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const files = [
      ...m.content_scripts.flatMap((c) => c.js),
      ...(m.background.scripts || [m.background.service_worker]),
      m.action.default_popup, m.options_ui.page, ...Object.values(m.icons),
    ];
    for (const f of files) assert.ok(fs.existsSync(path.join(dir, f)), target + ": missing " + f);
    assert.ok(!fs.existsSync(path.join(dir, "test")), "no test files in the package");
    if (target === "firefox") {
      assert.ok(m.browser_specific_settings.gecko.id);
      assert.deepEqual(m.background.scripts.slice(-1), ["src/background.js"]);
    }
    assert.ok(fs.existsSync(path.join(ROOT, "dist", "forreal-" + target + ".zip")));
  }
});

test("demo page and live bundle load the same content scripts as the manifest, in order", () => {
  const js = readJSON("manifest.json").content_scripts[0].js;
  const demo = [...read("test/demo.html").matchAll(/<script src="\.\.\/(src\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(demo, js);
  const bundle = JSON.parse(read("tools/bundle.py").match(/files = (\[[^\]]+\])/)[1]).filter((f) => f.startsWith("src/"));
  assert.deepEqual(bundle, js);
});

test("pages load their scripts from the package", () => {
  for (const page of ["src/popup/popup.html", "src/options/options.html"]) {
    for (const m of read(page).matchAll(/src="([^"]+)"/g)) {
      assert.doesNotMatch(m[1], /^https?:/, page + ": remote script");
      assert.ok(fs.existsSync(path.join(ROOT, path.dirname(page), m[1])), page + ": " + m[1]);
    }
  }
});
