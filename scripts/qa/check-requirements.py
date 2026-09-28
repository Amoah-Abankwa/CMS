#!/usr/bin/env python3
"""
Checks ANU's design rules across the frontend and outgoing messages:
no gradients, no emojis, colours only from theme tokens (so light and dark mode both work),
and no leftover debugging output.
Run: python3 scripts/qa/check-requirements.py   (exit code 1 if anything is wrong)
"""
import re, sys, glob, os
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
def files(*patterns):
    out = []
    for p in patterns: out += [f for f in glob.glob(os.path.join(ROOT, p), recursive=True) if 'node_modules' not in f]
    return sorted(set(out))

EMOJI = re.compile('[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF\U0001F900-\U0001F9FF\u2B50\u2B55\u231A\u231B\u23E9-\u23FA\uFE0F]')
PALETTE = re.compile(r'\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black)(?:-\d{2,3})?\b')
HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')
problems, count = [], 0

ui = files('frontend/src/**/*.tsx', 'frontend/src/**/*.ts', 'frontend/src/**/*.css')
messages = files('backend/src/modules/notifications/templates.ts', 'backend/src/**/*.service.ts')
for path in ui + messages:
    rel = os.path.relpath(path, ROOT)
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        count += 1
        if 'gradient' in line.lower() and 'no gradient' not in line.lower():
            problems.append(f'Gradient: {rel}:{n}')
        if EMOJI.search(line):
            problems.append(f'Emoji: {rel}:{n}: {line.strip()[:80]}')
        if path in ui and not path.endswith('.css'):
            # Allowed: a translucent black scrim behind dialogs (right in both themes), and
            # print-only borders (paper is always white).
            # print: classes only apply on paper, which is always white.
            hit = PALETTE.search(re.sub(r'print:[\w/-]+|(?:backdrop:)?bg-black/\d+', '', line))
            # An element hidden on screen and shown only when printing.
            if hit and re.search(r'\bhidden\b', line) and 'print:block' in line:
                hit = None
            if hit:
                problems.append(f'Fixed colour (breaks dark mode): {rel}:{n}: {hit.group(0)}')
            h = HEX.search(line)
            # Hex colours belong in globals.css tokens. A few non-visual strings are allowed.
            # The browser toolbar colour (themeColor) must be a literal value.
            if h and "prefers-color-scheme" not in line and 'favicon' not in line and '&#' not in line and not re.search(r"['\"`]#[\w-]*['\"`]\s*[,)]?\s*$", line.strip()):
                problems.append(f'Hex colour outside theme tokens: {rel}:{n}: {h.group(0)}')
        if re.search(r'\bconsole\.(log|debug)\(', line) and '/scripts/' not in path:
            problems.append(f'Debug output: {rel}:{n}')

# Every colour token defined for light mode must also be defined for dark mode.
css = open(os.path.join(ROOT, 'frontend/src/app/globals.css'), encoding='utf-8').read()
def block(selector):
    m = re.search(re.escape(selector) + r'\s*\{(.*?)\n\}', css, re.S)
    return set(re.findall(r'(--[\w-]+):', m.group(1))) if m else set()
light, dark = block(':root'), block('.dark')
colour_tokens = {t for t in light if not re.search(r'radius|font|shadow|space|width|height|size', t)}
for t in sorted(colour_tokens - dark): problems.append(f'Theme token {t} has no dark-mode value')

print(f'{len(ui) + len(messages)} files, {count} lines checked; {len(colour_tokens)} colour tokens, {len(dark)} dark values')
for p in problems: print('PROBLEM', p)
print(f'{len(problems)} problems')
sys.exit(1 if problems else 0)
