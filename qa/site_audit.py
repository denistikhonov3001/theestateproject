from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
warnings = []
checks = 0

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.resources = []
        self.scripts = []
        self.metas = []
        self.canonicals = []
        self.lang_buttons = []
        self.policy_blocks = []
        self.tags = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.tags.append(tag)
        if d.get("id"):
            self.ids.append(d["id"])
        if tag == "a" and d.get("href"):
            self.links.append((d["href"], d))
        if tag in {"img", "script", "link"}:
            u = d.get("src") or d.get("href")
            if u:
                self.resources.append((u, tag, d))
        if tag == "script":
            self.scripts.append(d)
        if tag == "meta":
            self.metas.append(d)
        if tag == "link":
            rel = str(d.get("rel", "")).lower()
            if "canonical" in rel and d.get("href"):
                self.canonicals.append(d["href"])
        if "class" in d and "lang" in str(d.get("class", "")).split() and d.get("data-lang"):
            self.lang_buttons.append(d["data-lang"])
        if d.get("data-policy-block"):
            self.policy_blocks.append(d["data-policy-block"])

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

def local_target(base: Path, url: str):
    if not url or url.startswith(("#", "mailto:", "tel:", "data:", "https://", "//")):
        return None
    if url.startswith("http://"):
        return None
    clean = urlsplit(url).path
    if not clean:
        return None
    if clean.startswith("/"):
        return ROOT / clean.lstrip("/")
    return base / clean

def robots_value(parser: PageParser):
    for m in parser.metas:
        if str(m.get("name", "")).lower() == "robots":
            return str(m.get("content", "")).lower()
    return ""

html_files = sorted(ROOT.glob("*.html"))
for f in html_files:
    parser = PageParser()
    text = f.read_text(encoding="utf-8")
    parser.feed(text)

    checks += 1
    if len(parser.ids) != len(set(parser.ids)):
        errors.append(f"{f.name}: duplicate id values")

    for forbidden in {"iframe", "object", "embed", "form"}:
        checks += 1
        if forbidden in parser.tags:
            errors.append(f"{f.name}: forbidden <{forbidden}> element")

    for href, attrs in parser.links:
        checks += 1
        if href.startswith("http://"):
            errors.append(f"{f.name}: insecure external link {href}")
        if href.lower().startswith("javascript:"):
            errors.append(f"{f.name}: javascript: URL is not allowed")
        target = local_target(f.parent, href)
        if target is not None and not target.exists():
            errors.append(f"{f.name}: missing local link {href}")
        if attrs.get("target") == "_blank":
            checks += 1
            rel = str(attrs.get("rel", ""))
            if "noopener" not in rel or "noreferrer" not in rel:
                errors.append(f"{f.name}: target=_blank must include noopener noreferrer: {href}")

    for url, tag, attrs in parser.resources:
        checks += 1
        if url.startswith("http://"):
            errors.append(f"{f.name}: insecure {tag} resource {url}")
        target = local_target(f.parent, url)
        if target is not None and not target.exists():
            errors.append(f"{f.name}: missing {tag} resource {url}")

    for script in parser.scripts:
        checks += 1
        if not script.get("src") and str(script.get("type", "")).lower() != "application/ld+json":
            errors.append(f"{f.name}: inline executable script is not allowed")

    if "noindex" not in robots_value(parser) and not f.name.startswith("google"):
        checks += 1
        if not parser.canonicals:
            errors.append(f"{f.name}: indexable page is missing a canonical URL")
        checks += 1
        csp = [m for m in parser.metas if str(m.get("http-equiv", "")).lower() == "content-security-policy"]
        if not csp:
            errors.append(f"{f.name}: indexable page is missing Content-Security-Policy metadata")

    policy_langs = set(parser.policy_blocks)
    if policy_langs:
        checks += 1
        buttons = set(parser.lang_buttons)
        if not policy_langs.issubset(buttons):
            errors.append(f"{f.name}: language buttons do not expose all published policy languages")
        if not buttons.issubset(policy_langs):
            errors.append(f"{f.name}: language switcher exposes unpublished languages {sorted(buttons-policy_langs)}")

manual_languages = {
    "contact.html": {"en", "ru"},
    "updates.html": {"en", "ru"},
    "credits.html": {"en"},
    "security.html": {"en"},
}
for name, expected in manual_languages.items():
    f = ROOT / name
    if not f.exists():
        continue
    parser = PageParser()
    parser.feed(f.read_text(encoding="utf-8"))
    checks += 1
    got = set(parser.lang_buttons)
    if got != expected:
        errors.append(f"{name}: language selector should be {sorted(expected)}, got {sorted(got)}")

# Main page separation: direct project cross-links only occur through the overview.
checks += 2
if "titanic.html" in (ROOT / "estate.html").read_text(encoding="utf-8"):
    errors.append("estate.html: direct Titanic link violates project separation")
if "estate.html" in (ROOT / "titanic.html").read_text(encoding="utf-8"):
    errors.append("titanic.html: direct Estate link violates project separation")

# Translation parity.
tr_path = ROOT / "translations-v86.js"
tr_raw = tr_path.read_text(encoding="utf-8").strip()
try:
    translations = json.loads(tr_raw.split("=", 1)[1].rstrip(" ;\n"))
except Exception as exc:
    errors.append(f"translations-v86.js: cannot parse translations: {exc}")
    translations = {}
checks += 1
if len(translations) != 12:
    errors.append(f"translations-v86.js: expected 12 languages, got {len(translations)}")
if translations.get("en"):
    base = set(translations["en"])
    for lang, data in translations.items():
        checks += 1
        if set(data) != base:
            missing = sorted(base - set(data))[:8]
            extra = sorted(set(data) - base)[:8]
            errors.append(f"translations-v86.js: {lang} key mismatch; missing={missing}, extra={extra}")

required = [
    "CNAME", ".nojekyll", "robots.txt", "sitemap.xml", ".well-known/security.txt", "security.txt",
    "BingSiteAuth.xml", "google109133360c700689.html",
    "index.html", "estate.html", "titanic.html", "research.html", "research-grand-staircase.html", "get-involved.html",
    "titanic-operating-concepts.html", "media.html", "support.html", "support-policy.html",
    "refund-policy.html", "contact.html", "status.html", "updates.html", "terms.html",
    "privacy.html", "security.html", "credits.html", "thank-you.html", "payment-failed.html", "404.html"
]
for req in required:
    checks += 1
    if not (ROOT / req).exists():
        errors.append(f"missing required public file: {req}")

checks += 1
if (ROOT / "CNAME").read_text(encoding="utf-8").strip() != "theestateproject.com":
    errors.append("CNAME: expected theestateproject.com")

checks += 1
robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
if "Sitemap: https://theestateproject.com/sitemap.xml" not in robots:
    errors.append("robots.txt: sitemap declaration missing")

checks += 2
security = (ROOT / ".well-known" / "security.txt").read_text(encoding="utf-8")
if "Canonical: https://theestateproject.com/.well-known/security.txt" not in security:
    errors.append(".well-known/security.txt: canonical well-known URL missing")
if "Contact: mailto:theestateproject2@gmail.com" not in security:
    errors.append(".well-known/security.txt: contact email missing")

checks += 1
if '/.well-known/security.txt' not in (ROOT / "security.html").read_text(encoding="utf-8"):
    errors.append("security.html: must link to /.well-known/security.txt")

# Basic accessibility guardrails.
for css_name in ["site-v86.css", "info-v86.css"]:
    checks += 1
    css = (ROOT / css_name).read_text(encoding="utf-8")
    if ":focus-visible" not in css:
        errors.append(f"{css_name}: explicit :focus-visible styling missing")

# Security-sensitive JavaScript patterns.
for js_name in ["site-v86.js", "info-v86.js"]:
    js = (ROOT / js_name).read_text(encoding="utf-8")
    for pattern in ["eval(", "new Function(", "document.write(", "srcdoc="]:
        checks += 1
        if pattern in js:
            errors.append(f"{js_name}: dangerous JavaScript pattern {pattern}")

# Stale provider artifacts and obvious secret patterns.
public_text = "\n".join(
    p.read_text(encoding="utf-8", errors="ignore")
    for p in ROOT.iterdir()
    if p.is_file() and p.suffix.lower() in {".html", ".js", ".css", ".txt", ".xml", ".md", ".yml"}
)
checks += 1
if any(ROOT.glob("trybit-*.txt")) or re.search(r"TryBit\s+verification\s*:", public_text, re.I):
    errors.append("stale TryBit verification artifact remains in public files")

for pattern, label in [
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private key"),
    (r"(?i)(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}", "API/secret key"),
]:
    checks += 1
    if re.search(pattern, public_text):
        errors.append(f"possible {label} exposed in root public files")

print(f"Checks: {checks}")
print(f"Errors: {len(errors)}")
print(f"Warnings: {len(warnings)}")
for e in errors:
    print("ERROR:", e)
for w in warnings:
    print("WARNING:", w)
sys.exit(1 if errors else 0)
