"""Write test/popup-preview.html and test/options-preview.html: the real pages plus the API shim and sample stats."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
seed = """<script src="shim.js"></script><script>
chrome.storage.local._data.stats={day:new Date().toISOString().slice(0,10),posts:11,words:664,minutes:1.76,fluff:6,worth:4,
cats:{job:1,paper:2,broetry:1,event:1,personal:1,brag:1,ad:1,hype:1,release:1,bait:1}};
chrome.permissions={contains:async()=>true,request:async()=>true};chrome.runtime.openOptionsPage=()=>{};
</script>"""
for page in ("popup", "options"):
    html = (root / "src" / page / f"{page}.html").read_text()
    html = html.replace('href="../', 'href="../src/').replace('src="../', 'src="../src/')
    html = re.sub(r'(href|src)="(%s\.(css|js))"' % page, r'\1="../src/%s/\2"' % page, html)
    html = html.replace('<script src="../src/defaults.js">', seed + '<script src="../src/defaults.js">')
    (root / "test" / f"{page}-preview.html").write_text(html)
print("ok")
