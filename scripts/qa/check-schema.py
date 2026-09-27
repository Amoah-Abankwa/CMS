#!/usr/bin/env python3
"""
Static checks on the Prisma schema, without Prisma installed. Catches the mistakes that stop
`prisma generate` or a migration: unknown types, one-sided relations, relation names that do not
pair up, @relation fields/references that do not exist, and duplicate model or field names.
Run: python3 scripts/qa/check-schema.py   (exit code 1 if anything is wrong)
"""
import re, sys, glob, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SCALARS = {'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'}
models, enums, problems = {}, set(), []

for path in sorted(glob.glob(os.path.join(ROOT, 'backend/prisma/schema/*.prisma'))):
    text = open(path).read()
    for m in re.finditer(r'^(model|enum)\s+(\w+)\s*\{(.*?)^\}', text, re.S | re.M):
        kind, name, body = m.groups()
        where = os.path.basename(path)
        if kind == 'enum':
            if name in enums: problems.append(f'{where}: enum {name} defined twice')
            enums.add(name); continue
        if name in models: problems.append(f'{where}: model {name} defined twice')
        fields = {}
        for line in body.splitlines():
            line = line.split('//')[0].strip()
            if not line or line.startswith('@@'): 
                if line.startswith('@@'): fields.setdefault('@@', []).append(line)
                continue
            parts = line.split(None, 2)
            if len(parts) < 2: continue
            fname, ftype = parts[0], parts[1]
            attrs = parts[2] if len(parts) > 2 else ''
            if fname in fields: problems.append(f'{where}: {name}.{fname} defined twice')
            fields[fname] = (ftype, attrs)
        models[name] = (where, fields)

def base(t): return t.rstrip('?').replace('[]', '')

relations = []  # (model, field, target, relName, isList, hasFields)
for mname, (where, fields) in models.items():
    for fname, val in fields.items():
        if fname == '@@': continue
        ftype, attrs = val
        b = base(ftype)
        if b in SCALARS or b in enums: continue
        if b not in models:
            problems.append(f'{where}: {mname}.{fname} has unknown type {b}'); continue
        rn = re.search(r'@relation\(\s*"([^"]+)"', attrs) or re.search(r'@relation\([^)]*name:\s*"([^"]+)"', attrs)
        fm = re.search(r'fields:\s*\[([^\]]*)\]', attrs)
        rf = re.search(r'references:\s*\[([^\]]*)\]', attrs)
        if fm:
            for f in [x.strip() for x in fm.group(1).split(',')]:
                if f not in fields: problems.append(f'{where}: {mname}.{fname} uses missing field {f}')
            if rf:
                for r in [x.strip() for x in rf.group(1).split(',')]:
                    if r not in models[b][1]: problems.append(f'{where}: {mname}.{fname} references missing {b}.{r}')
            else:
                problems.append(f'{where}: {mname}.{fname} has fields but no references')
        relations.append((mname, fname, b, rn.group(1) if rn else None, ftype.endswith('[]'), bool(fm)))

# Every relation needs exactly one opposite side with the same name (or both unnamed).
for (m, f, t, rn, lst, has) in relations:
    opposite = [r for r in relations if r[0] == t and r[2] == m and r[3] == rn and not (r[0] == m and r[1] == f)]
    if m == t:  # self relation: the pair is within the same model
        opposite = [r for r in relations if r[0] == m and r[2] == m and r[3] == rn and r[1] != f]
    if len(opposite) != 1:
        problems.append(f'{models[m][0]}: {m}.{f} -> {t} relation "{rn or "(unnamed)"}" has {len(opposite)} opposite fields (needs 1)')
    elif not has and not opposite[0][5]:
        if not (lst or opposite[0][4]):
            problems.append(f'{models[m][0]}: one-to-one {m}.{f} <-> {t}.{opposite[0][1]} has no side with fields/references')

# One-to-one relations need a unique scalar on the side holding the foreign key.
for (m, f, t, rn, lst, has) in relations:
    if not has: continue
    opp = [r for r in relations if r[0] == t and r[2] == m and r[3] == rn and r[1] != f]
    if opp and not opp[0][4]:
        attrs = models[m][1][f][1]
        fk = re.search(r'fields:\s*\[([^\]]*)\]', attrs).group(1).strip()
        fk_attrs = models[m][1].get(fk, ('', ''))[1]
        uniques = ' '.join(models[m][1].get('@@', []))
        if '@unique' not in fk_attrs and '@id' not in fk_attrs and not re.search(r'@@(unique|id)\(\[\s*' + re.escape(fk) + r'\s*\]', uniques):
            problems.append(f'{models[m][0]}: one-to-one {m}.{f}: {m}.{fk} must be @unique')

print(f'{len(models)} models, {len(enums)} enums, {len(relations)} relation fields checked')
for p in problems: print('PROBLEM', p)
sys.exit(1 if problems else 0)
