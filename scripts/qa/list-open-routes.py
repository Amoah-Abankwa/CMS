#!/usr/bin/env python3
"""
Lists API routes with no @RequirePermission (on the class or the method), split into public routes
(no sign-in) and signed-in routes. Every signed-in route here must check ownership or account type
in its service; docs/QA.md records that review. Fails if a route appears that is not in the
reviewed list below, so new open routes get looked at.
Run: python3 scripts/qa/list-open-routes.py
"""
import re, sys, glob, os
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
REVIEWED = set(open(os.path.join(os.path.dirname(__file__), 'reviewed-open-routes.txt')).read().split('\n')) if os.path.exists(os.path.join(os.path.dirname(__file__), 'reviewed-open-routes.txt')) else set()
public, member = [], []
for path in sorted(glob.glob(os.path.join(ROOT, 'backend/src/**/*.controller.ts'), recursive=True)):
    text = open(path).read()
    for cls in re.finditer(r"((?:@\w+\([^)]*\)\s*)*)@Controller\(\s*(?:'([^']*)')?\s*\)((?:\s*@\w+\([^)]*\))*)\s*export class (\w+)(.*?)(?=(?:@\w+\([^)]*\)\s*)*@Controller\(|\Z)", text, re.S):
        decorators = cls.group(1) + cls.group(3)
        class_guard = 'RequirePermission' in decorators or 'RequireAnyPermission' in decorators
        class_public = '@Public' in decorators
        prefix, body = (cls.group(2) or '').strip('/'), cls.group(5)
        for m in re.finditer(r"((?:@\w+(?:\([^)]*\))?\s*)*)@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)((?:\s*@\w+(?:\([^)]*\))?)*)\s*(?:async\s+)?(\w+)\(", body):
            decs = m.group(1) + m.group(4)
            route = f"{m.group(2).upper()} /{'/'.join(x for x in [prefix, (m.group(3) or '').strip('/')] if x)}"
            if class_guard or 'RequirePermission' in decs or 'RequireAnyPermission' in decs: continue
            (public if class_public or '@Public' in decs else member).append(f'{route}  ({cls.group(4)}.{m.group(5)})')
print(f'Public (no sign-in): {len(public)}'); [print('  ', r) for r in public]
print(f'Signed in, no permission check at the route: {len(member)}'); [print('  ', r) for r in member]
new = [r for r in public + member if r.split('  (')[0] not in REVIEWED]
if REVIEWED and new:
    print('NOT YET REVIEWED:'); [print('  ', r) for r in new]; sys.exit(1)
