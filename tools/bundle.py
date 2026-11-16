"""Concatenate shim + content scripts into one compact file for pasting into a live page during testing."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
files = ["test/shim.js", "src/defaults.js", "src/content/classifier.js", "src/content/policy.js", "src/content/sites.js", "src/content/overlay.js", "src/content/main.js"]
out = []
for f in files:
    s = (root / f).read_text()
    s = re.sub(r"^/\*.*?\*/\s*", "", s, flags=re.S)
    lines = [l.strip() for l in s.splitlines()]
    out.append("\n".join(l for l in lines if l and not l.startswith("//")))
(root / "tools" / "live-bundle.js").write_text("\n;\n".join(out) + "\n")
