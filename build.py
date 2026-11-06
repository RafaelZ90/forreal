"""Build store-ready packages: dist/unspin-chrome.zip (Chrome, Edge, Brave, Opera) and dist/unspin-firefox.zip.
Unpacked folders land in dist/chrome and dist/firefox (and ~/Desktop/ForReal is refreshed if it exists) for 'Load unpacked' / 'Load temporary add-on'.
Safari: xcrun safari-web-extension-converter dist/chrome
"""
import json, pathlib, shutil, zipfile

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
FILES = ["src", "icons", "LICENSE", "README.md"]


def copy(target):
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for f in FILES:
        src = ROOT / f
        if src.is_dir():
            shutil.copytree(src, target / f)
        elif src.exists():
            shutil.copy2(src, target / f)


def zipdir(folder, out):
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob("*")):
            if p.is_file() and p.name != ".DS_Store":
                z.write(p, p.relative_to(folder).as_posix())


def main():
    base = json.loads((ROOT / "manifest.json").read_text())
    DIST.mkdir(exist_ok=True)

    chrome = DIST / "chrome"
    copy(chrome)
    (chrome / "manifest.json").write_text(json.dumps(base, indent=2, ensure_ascii=False))
    zipdir(chrome, DIST / "unspin-chrome.zip")

    ff = json.loads(json.dumps(base))
    ff["background"] = {"scripts": ["src/defaults.js", "src/ai-chrome.js", "src/background.js"]}
    ff["permissions"] = [p for p in ff["permissions"] if p != "offscreen"]  # Chrome-only
    ff["browser_specific_settings"] = {"gecko": {"id": "unspin@feed-decoder", "strict_min_version": "121.0"}}
    firefox = DIST / "firefox"
    copy(firefox)
    (firefox / "manifest.json").write_text(json.dumps(ff, indent=2, ensure_ascii=False))
    zipdir(firefox, DIST / "unspin-firefox.zip")
    print("built", ", ".join(str(p.relative_to(ROOT)) for p in sorted(DIST.glob("*.zip"))))

    # Keep the copy that Chrome loads from the Desktop in step (only if it exists; never creates it).
    for name in ("ForReal", "Unspin"):  # "Unspin" was the folder's earlier name; refresh whichever Chrome loads
        desktop = pathlib.Path.home() / "Desktop" / name
        if (desktop / "manifest.json").exists():
            shutil.rmtree(desktop)
            shutil.copytree(chrome, desktop)
            print("updated", desktop)


if __name__ == "__main__":
    main()
