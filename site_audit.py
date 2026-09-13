from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import re,json,sys
ROOT=Path(__file__).resolve().parent.parent
errors=[]; warnings=[]; checks=0
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.links=[]; self.resources=[]; self.scripts=[]; self.inline_styles=0; self.tags=[]; self.metas=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs); self.tags.append(tag)
        if 'id' in d:self.ids.append(d['id'])
        if tag=='a' and 'href' in d:self.links.append((d['href'],d))
        if tag in {'img','script','link'}:
            u=d.get('src') or d.get('href')
            if u:self.resources.append((u,tag,d))
        if tag=='script':self.scripts.append(d)
        if tag=='meta':self.metas.append(d)
        if 'style' in d:self.inline_styles+=1

def local_target(base,u):
    if not u or u.startswith(('#','mailto:','tel:','data:','http://','https://','//')): return None
    clean=urlsplit(u).path
    if clean.startswith('/'):
        return ROOT/clean.lstrip('/')
    return (base/clean)

html_files=list(ROOT.glob('*.html'))
for f in html_files:
    p=P(); txt=f.read_text(encoding='utf-8'); p.feed(txt)
    checks+=1
    if len(p.ids)!=len(set(p.ids)): errors.append(f'{f.name}: duplicate ids')
    for bad in ['iframe','object','embed','form']:
        checks+=1
        if bad in p.tags: errors.append(f'{f.name}: forbidden <{bad}>')
    checks+=1
    if p.inline_styles: errors.append(f'{f.name}: inline style attrs')
    for s in p.scripts:
        checks+=1
        if not s.get('src'): errors.append(f'{f.name}: inline script')
    for href,a in p.links:
        checks+=1
        if href.startswith('http://'): errors.append(f'{f.name}: insecure external link {href}')
        target=local_target(f.parent,href)
        if target is not None and not target.exists(): errors.append(f'{f.name}: missing link {href}')
        if a.get('target')=='_blank':
            checks+=1; rel=' '.join(a.get('rel',[])) if isinstance(a.get('rel'),list) else (a.get('rel') or '')
            if 'noopener' not in rel or 'noreferrer' not in rel: errors.append(f'{f.name}: unsafe target blank {href}')
    for u,tag,d in p.resources:
        checks+=1
        if u.startswith('http://'): errors.append(f'{f.name}: insecure {tag} resource {u}')
        target=local_target(f.parent,u)
        if target is not None and not target.exists(): errors.append(f'{f.name}: missing {tag} resource {u}')
    checks+=1
    if f.name in {'index.html','estate.html','titanic.html','support.html','status.html'}:
        csp=[m for m in p.metas if str(m.get('http-equiv','')).lower()=='content-security-policy']
        if not csp: errors.append(f'{f.name}: CSP missing')

# Estate/Titanic separation
checks+=2
if 'titanic.html' in (ROOT/'estate.html').read_text(encoding='utf-8'): errors.append('estate.html direct Titanic link')
if 'estate.html' in (ROOT/'titanic.html').read_text(encoding='utf-8'): errors.append('titanic.html direct Estate link')

# security/dangerous constructs
for f in (ROOT/'assets').glob('*.js'):
    txt=f.read_text(encoding='utf-8')
    for pat in ['eval(','new Function','innerHTML=','outerHTML=','document.write','insertAdjacentHTML','srcdoc']:
        checks+=1
        if pat in txt: errors.append(f'{f.name}: dangerous pattern {pat}')

# translation parity
tr=(ROOT/'assets'/'translations-v86.js').read_text(encoding='utf-8')
obj=json.loads(tr.split('=',1)[1].rstrip(' ;\n')); base=set(obj['en'])
checks+=1
if len(obj)!=12: errors.append(f'expected 12 languages, got {len(obj)}')
for l,d in obj.items():
    checks+=1
    if set(d)!=base: errors.append(f'translation key mismatch {l}: missing {sorted(base-set(d))[:5]}, extra {sorted(set(d)-base)[:5]}')

# required public files
required=['CNAME','robots.txt','sitemap.xml','.well-known/security.txt','trybit-twfj4nw8ojqlwc17z7gccm19htwpw0z3.txt','BingSiteAuth.xml','google109133360c700689.html','support.html','support-policy.html','refund-policy.html','contact.html','status.html','updates.html','terms.html','privacy.html','thank-you.html','payment-failed.html','404.html']
for req in required:
    checks+=1
    if not (ROOT/req).exists(): errors.append(f'missing {req}')
checks+=3
if (ROOT/'CNAME').read_text().strip()!='theestateproject.com': errors.append('wrong CNAME')
if (ROOT/'trybit-twfj4nw8ojqlwc17z7gccm19htwpw0z3.txt').read_text().strip()!='twfj4nw8ojqlwc17z7gccm19htwpw0z3': errors.append('TryBit verification changed')
if '7D7D79D09267CD966152338E8147E548' not in (ROOT/'BingSiteAuth.xml').read_text(): errors.append('Bing verification token missing')

# no stale visible progress claim / old storage as current key
visible='\n'.join(f.read_text(encoding='utf-8',errors='ignore') for f in html_files)
checks+=2
if re.search(r'Project progress\s*0%|прогресс проекта\s*0%',visible,re.I): errors.append('stale 0% progress copy')
sitejs=(ROOT/'assets'/'site-v86.js').read_text()
if "const STORE='tep-final-v86'" not in sitejs: errors.append('v8.6 storage key missing')

# secrets scan
blob='\n'.join(f.read_text(encoding='utf-8',errors='ignore') for f in ROOT.rglob('*') if f.is_file() and f.suffix.lower() in {'.html','.js','.css','.txt','.xml','.md','.yml'})
for pat,name in [(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','private key'),(r'(?i)(api[_-]?key|secret[_-]?key)\s*[:=]\s*["\'][A-Za-z0-9_\-]{16,}', 'api/secret key')]:
    checks+=1
    if re.search(pat,blob): errors.append('possible '+name)

print(f'Checks: {checks}')
print(f'Errors: {len(errors)}')
print(f'Warnings: {len(warnings)}')
for e in errors: print('ERROR:',e)
for w in warnings: print('WARNING:',w)
sys.exit(1 if errors else 0)
