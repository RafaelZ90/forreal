/* demo.html?selftest: a post whose text is shorter while folded (as on LinkedIn) must not flicker
   when the reader presses Show post and then Fold. Prints PASS/FAIL in the page header. */
(async () => {
  if (!/selftest/.test(location.search)) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(1200);
  const box = document.querySelector("#li [data-unspin-fold]");
  const span = box.querySelector(".update-components-text span");
  const full = span.textContent, short = full.slice(0, Math.floor(full.length * 0.6));
  new MutationObserver(() => {
    const want = box.hasAttribute("data-unspin-fold") ? short : full;
    if (span.textContent !== want) span.textContent = want;
  }).observe(box, { attributes: true, attributeFilter: ["data-unspin-fold"] });
  span.textContent = short;
  let flips = 0;
  new MutationObserver(() => flips++).observe(box, { attributes: true, attributeFilter: ["data-unspin-fold"] });
  const btn = () => box.querySelector(".unspin-host").shadowRoot.querySelector(".btn");
  await wait(800); flips = 0;
  btn().click(); await wait(1500);
  const shown = !box.hasAttribute("data-unspin-fold") && flips === 1;
  flips = 0; btn().click(); await wait(2500);
  const folded = box.hasAttribute("data-unspin-fold") && flips === 1;
  const ok = shown && folded;
  const out = document.createElement("b");
  out.id = "selftest";
  out.textContent = (ok ? "SELFTEST PASS" : "SELFTEST FAIL") + " (show/fold stays put)";
  out.style.color = ok ? "#057642" : "#cc1016";
  document.querySelector(".bar").appendChild(out);
})();
