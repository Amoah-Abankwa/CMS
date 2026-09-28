#!/usr/bin/env python3
"""
Cross-checks that the pieces of the platform line up, without running it:
  1. every API call in the frontend matches a backend route and HTTP method
  2. every sidebar link and in-app link points at a page that exists
  3. every permission used exists in shared/permissions.ts, and every permission is given to some role
  4. every notification sent has a template, and every template is used
  5. every activity-log action recorded has a readable label
Run: python3 scripts/qa/check-wiring.py   (exit code 1 if anything is wrong)
"""
import re, sys, glob, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
def read(p): return open(p, encoding='utf-8').read()
def files(pattern): return [p for p in glob.glob(os.path.join(ROOT, pattern), recursive=True) if 'node_modules' not in p]
problems, notes = [], []

# ---------- 1. API routes ----------
routes = set()
for path in files('backend/src/**/*.controller.ts'):
    text = read(path)
    for cls in re.finditer(r"@Controller\(\s*(?:'([^']*)')?\s*\)(.*?)(?=@Controller\(|\Z)", text, re.S):
        prefix, body = (cls.group(1) or '').strip('/'), cls.group(2)
        for m in re.finditer(r"@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)", body):
            sub = (m.group(2) or '').strip('/')
            full = '/'.join(x for x in [prefix, sub] if x)
            routes.add((m.group(1).upper(), re.sub(r':\w+', '*', full)))

def match(method, url):
    segs = url.split('/')
    for (m, r) in routes:
        if m != method: continue
        rs = r.split('/')
        if len(rs) == len(segs) and all(a == '*' or b == '*' or a == b for a, b in zip(rs, segs)):
            return True
    return False

calls = 0
for path in files('frontend/src/**/*.ts') + files('frontend/src/**/*.tsx'):
    text = read(path)
    # Expand small URL helpers such as: const base = (id: string) => `/teaching/classes/${id}`;
    for h in re.finditer(r"const (\w+) = \([^)]*\) => `([^`]*)`;", text):
        text = re.sub(r'\$\{' + h.group(1) + r'\([^)]*\)\}', h.group(2).replace('\\', r'\\'), text)
    for m in re.finditer(r"\bapi\.(get|post|put|patch|delete)(?:<[^()]*?>)?\(\s*([`'])(.*?)\2", text, re.S):
        method, raw = m.group(1).upper(), m.group(3)
        url = re.sub(r'\$\{[^}]*\}', '*', raw).split('?')[0].strip('/')
        url = re.sub(r'\*[^/]*', '*', url)  # e.g. `${id}/x` pieces
        calls += 1
        if not match(method, url):
            problems.append(f'API: {method} /{url} called in {os.path.relpath(path, ROOT)} has no backend route')
# PDF downloads are plain links to API routes: <PdfLink api="/me/fees/receipts/${id}/pdf" /> and pdf={`...`}
for path in files('frontend/src/**/*.tsx'):
    for m in re.finditer(r"(?:<PdfLink api=|\bpdf=)\{?\s*([`'])(/[^`']*)\1", read(path)):
        url = re.sub(r'\$\{[^}]*\}', '*', m.group(2)).strip('/')
        calls += 1
        if not match('GET', url):
            problems.append(f'PDF link: GET /{url} in {os.path.relpath(path, ROOT)} has no backend route')
notes.append(f'{len(routes)} backend routes, {calls} frontend API calls checked')

# ---------- 2. Pages and links ----------
pages = set()
for p in files('frontend/src/app/**/page.tsx'):
    rel = os.path.relpath(os.path.dirname(p), os.path.join(ROOT, 'frontend/src/app'))
    segs = [s for s in rel.split(os.sep) if s != '.' and not (s.startswith('(') and s.endswith(')'))]
    pages.add('/' + '/'.join('*' if s.startswith('[') else s for s in segs))
def page_exists(href):
    segs = href.split('?')[0].split('#')[0].strip('/').split('/') if href.strip('/') else []
    for pg in pages:
        ps = pg.strip('/').split('/') if pg.strip('/') else []
        if len(ps) == len(segs) and all(a == '*' or b == '*' or a == b for a, b in zip(ps, segs)):
            return True
    return False
links = 0
for path in files('frontend/src/**/*.ts') + files('frontend/src/**/*.tsx'):
    text = read(path)
    for m in re.finditer(r"""(?:href[=:]\s*\{?\s*|router\.(?:push|replace)\(\s*|redirect\(\s*)([`'"])(/[^`'"]*)\1""", text):
        href = re.sub(r'\$\{[^}]*\}', '*', m.group(2))
        if href.startswith('/api') or href.startswith('//'): continue
        links += 1
        if not page_exists(href): problems.append(f'Link: {href} in {os.path.relpath(path, ROOT)} has no page')
for path in files('backend/src/**/*.ts'):
    for m in re.finditer(r"\blink:\s*([`'])(/[^`']*)\1", read(path)):
        href = re.sub(r'\$\{[^}]*\}', '*', m.group(2)); links += 1
        if not page_exists(href): problems.append(f'Notification link: {href} in {os.path.relpath(path, ROOT)} has no page')
notes.append(f'{len(pages)} pages, {links} links checked')

# ---------- 3. Permissions ----------
perm_text = read(os.path.join(ROOT, 'shared/src/permissions.ts'))
block = perm_text[perm_text.index('export const PERMISSIONS'):perm_text.index('} as const')]
perms = set(re.findall(r'^\s*(\w+):\s*\'', block, re.M))
used = set()
for path in files('backend/src/**/*.ts') + files('frontend/src/**/*.ts') + files('frontend/src/**/*.tsx') + files('backend/prisma/seed/*.ts'):
    for m in re.finditer(r'\b(?:PERMISSIONS|P)\.([A-Z_]+)\b', read(path)):
        used.add(m.group(1))
        if m.group(1) not in perms: problems.append(f'Permission: {m.group(1)} used in {os.path.relpath(path, ROOT)} does not exist')
seed = read(os.path.join(ROOT, 'backend/prisma/seed/data.ts'))
roles_block = seed[seed.index('export const ROLE_DEFS'):seed.index('export const LEVELS')]
granted = set(re.findall(r'\bP\.([A-Z_]+)', roles_block))
# The Super Admin role is built from all permissions except decisions; count it as granting the rest.
decisions = set(re.findall(r'PERMISSIONS\.([A-Z_]+)', perm_text[perm_text.index('ACADEMIC_DECISION_PERMISSIONS'):]))
if 'SUPER_ADMIN' in roles_block or 'ALL_PERMISSIONS' in seed:
    granted |= (perms - decisions)
for p in sorted(perms - granted): problems.append(f'Permission: {p} is not given to any role')
notes.append(f'{len(perms)} permissions checked')

# ---------- 4. Notifications ----------
tpl = read(os.path.join(ROOT, 'backend/src/modules/notifications/templates.ts'))
keys = dict(re.findall(r'^\s*(\w+):\s*\'([\w.]+)\',', tpl[tpl.index('EVENT_KEYS'):tpl.index('} as const')], re.M))
templated = set(re.findall(r'eventKey:\s*EVENT_KEYS\.(\w+)', tpl))
sent = set()
for path in files('backend/src/**/*.ts'):
    if path.endswith('templates.ts'): continue
    for k in re.findall(r'EVENT_KEYS\.(\w+)', read(path)):
        sent.add(k)
        if k not in keys: problems.append(f'Notification: EVENT_KEYS.{k} in {os.path.relpath(path, ROOT)} does not exist')
for k in sorted(set(keys) - templated): problems.append(f'Notification: {k} has no template')
unused = sorted(templated - sent)
if unused: notes.append('Templates never sent from code (fine if sent elsewhere): ' + ', '.join(unused))
notes.append(f'{len(keys)} notification events checked')

# ---------- 5. Activity labels ----------
labels = read(os.path.join(ROOT, 'frontend/src/features/audit/labels.ts'))
labelled = set(re.findall(r"^\s*'([\w.]+)':", labels, re.M))
actions = 0
for path in files('backend/src/**/*.ts'):
    text = read(path)
    for m in re.finditer(r"action:\s*([`'])([^`']+)\1", text):
        a = m.group(2); actions += 1
        if '${' in a:
            prefix = a.split('${')[0]
            if not any(l.startswith(prefix) for l in labelled): problems.append(f'Activity label: nothing labelled for {a} ({os.path.relpath(path, ROOT)})')
        elif a not in labelled: problems.append(f'Activity label: {a} ({os.path.relpath(path, ROOT)}) has no label')
modules = set(re.findall(r"module:\s*'(\w+)'", ' '.join(read(p) for p in files('backend/src/**/*.ts'))))
module_opts = set(re.findall(r"value:\s*'(\w+)'", labels[labels.index('MODULE_OPTIONS'):]))
for m in sorted(modules - module_opts): problems.append(f'Activity filter: module "{m}" is missing from MODULE_OPTIONS')
notes.append(f'{actions} activity records checked')

# ---------- 6. Duplicate imports (a TypeScript error the syntax check misses) ----------
dups = 0
for path in files('frontend/src/**/*.ts') + files('frontend/src/**/*.tsx') + files('backend/src/**/*.ts') + files('shared/src/**/*.ts'):
    text = read(path)
    imported = []
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s+from", text):
        for n in m.group(1).split(','):
            n = n.strip()
            if not n: continue
            local = n.split(' as ')[-1].replace('type ', '').strip()
            imported.append(local)
    for n in set(imported):
        if imported.count(n) > 1:
            dups += 1
            problems.append(f'Duplicate import: {n} in {os.path.relpath(path, ROOT)}')
notes.append('duplicate imports checked')

for n in notes: print('note', n)
for p in problems: print('PROBLEM', p)
print(f'{len(problems)} problems')
sys.exit(1 if problems else 0)
