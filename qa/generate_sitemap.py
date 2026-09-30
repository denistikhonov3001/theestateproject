from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from datetime import date
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://theestateproject.com"

class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = None
        self.robots = ""

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "link" and "canonical" in str(d.get("rel", "")).lower():
            self.canonical = d.get("href")
        if tag == "meta" and str(d.get("name", "")).lower() == "robots":
            self.robots = str(d.get("content", "")).lower()

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

def last_modified(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    try:
        value = subprocess.check_output(
            ["git", "log", "-1", "--format=%cs", "--", rel],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if value:
            return value
    except Exception:
        pass
    return date.today().isoformat()

entries = []
for path in sorted(ROOT.glob("*.html")):
    if path.name.startswith("google"):
        continue
    parser = MetaParser()
    parser.feed(path.read_text(encoding="utf-8"))
    if not parser.canonical or "noindex" in parser.robots:
        continue
    parsed = urlparse(parser.canonical)
    if parsed.scheme != "https" or parsed.netloc != "theestateproject.com":
        continue
    entries.append((parser.canonical, last_modified(path)))

entries.sort(key=lambda x: (0 if x[0] == DOMAIN + "/" else 1, x[0]))
lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for url, modified in entries:
    lines.append(f"  <url><loc>{escape(url)}</loc><lastmod>{modified}</lastmod></url>")
lines.append("</urlset>")
content = "\n".join(lines) + "\n"
out = ROOT / "sitemap.xml"

if "--check" in sys.argv:
    current = out.read_text(encoding="utf-8") if out.exists() else ""
    if current != content:
        print("sitemap.xml is out of date; run: python qa/generate_sitemap.py")
        sys.exit(1)
    print(f"sitemap.xml is current ({len(entries)} URLs)")
else:
    out.write_text(content, encoding="utf-8")
    print(f"Wrote sitemap.xml with {len(entries)} URLs")
