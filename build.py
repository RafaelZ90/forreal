"""Build store-ready packages: dist/forreal-chrome.zip (Chrome, Edge, Brave, Opera) and dist/forreal-firefox.zip.
Unpacked folders land in dist/chrome and dist/firefox for 'Load unpacked' / 'Load temporary add-on'.
`python3 build.py --desktop` also replaces ~/Desktop/ForReal with the Chrome build, but only if that folder already holds a ForReal build.
Safari: xcrun safari-web-extension-converter dist/chrome
"""
import json, pathlib, shutil, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
FILES = ["src", "icons", "LICENSE", "README.md", "PRIVACY.md"]


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
    zipdir(chrome, DIST / "forreal-chrome.zip")

    ff = json.loads(json.dumps(base))
    ff["background"] = {"scripts": ["src/defaults.js", "src/ai-chrome.js", "src/background.js"]}
    ff["permissions"] = [p for p in ff["permissions"] if p != "offscreen"]  # Chrome-only
    ff["browser_specific_settings"] = {"gecko": {
        "id": "forreal@forreal.extension", "strict_min_version": "121.0",
        # Rules and on-device AI keep everything local; the optional own-provider engines send post text to that provider.
        "data_collection_permissions": {"required": ["none"], "optional": ["websiteContent"]},
    }}
    firefox = DIST / "firefox"
    copy(firefox)
    (firefox / "manifest.json").write_text(json.dumps(ff, indent=2, ensure_ascii=False))
    zipdir(firefox, DIST / "forreal-firefox.zip")
    print("built", ", ".join(str(p.relative_to(ROOT)) for p in sorted(DIST.glob("*.zip"))))

    # Opt-in: keep a copy that Chrome loads from the Desktop in step. Replaces the folder only if it is a ForReal build.
    if "--desktop" in sys.argv:
        desktop = pathlib.Path.home() / "Desktop" / "ForReal"
        mf = desktop / "manifest.json"
        if mf.exists() and json.loads(mf.read_text()).get("short_name") == "ForReal":
            shutil.rmtree(desktop)
            shutil.copytree(chrome, desktop)
            print("updated", desktop)
        else:
            print("skipped", desktop, "(no ForReal build there; copy dist/chrome yourself the first time)")

if __name__ == "__main__":
    main()
