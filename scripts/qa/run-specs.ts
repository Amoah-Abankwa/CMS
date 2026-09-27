/**
 * Runs the pure-rule spec files (the ones that do not need NestJS or a database) without Jest
 * installed, using a small Jest-compatible describe/it/expect. In a normal setup, `pnpm --filter
 * backend test` runs every spec with real Jest; this is for environments without packages.
 *
 *   npx tsx --tsconfig scripts/qa/tsconfig.qa.json scripts/qa/run-specs.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

type Test = { name: string; fn: () => unknown };
const tests: Test[] = [];
const stack: string[] = [];
const g = globalThis as Record<string, unknown>;
g.describe = (name: string, fn: () => void) => { stack.push(name); fn(); stack.pop(); };
g.it = g.test = (name: string, fn: () => unknown) => tests.push({ name: [...stack, name].join(' > '), fn });

const subset = (actual: unknown, expected: unknown): boolean => {
  if (expected instanceof Partial_ || expected instanceof Contains_) return equal(actual, expected);
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    return !!actual && typeof actual === 'object' && Object.entries(expected).every(([k, v]) => subset((actual as Record<string, unknown>)[k], v));
  }
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => subset(actual[i], v));
  return isDeepStrictEqual(actual, expected);
};
/** Like Jest, toEqual ignores properties whose value is undefined. Asymmetric matchers, e.g. expect.objectContaining({ a: 1 }). */
class Partial_ { constructor(readonly expected: Record<string, unknown>) {} }
class Contains_ { constructor(readonly expected: unknown[]) {} }
const equal = (a: unknown, e: unknown): boolean => {
  if (e instanceof Partial_) return subset(a, e.expected);
  if (e instanceof Contains_) return Array.isArray(a) && e.expected.every((x) => a.some((y) => equal(y, x)));
  if (Array.isArray(e)) return Array.isArray(a) && a.length === e.length && e.every((x, i) => equal(a[i], x));
  if (e && typeof e === 'object' && !(e instanceof Date) && !(e instanceof RegExp)) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
    const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
    const ke = Object.keys(e).filter((k) => (e as Record<string, unknown>)[k] !== undefined);
    return ka.length === ke.length && ke.every((k) => equal((a as Record<string, unknown>)[k], (e as Record<string, unknown>)[k]));
  }
  return isDeepStrictEqual(a, e);
};
const show = (v: unknown) => { try { return JSON.stringify(v); } catch { return String(v); } };

function makeExpect(actual: unknown, negate = false) {
  const check = (ok: boolean, what: string) => {
    if (ok === negate) throw new Error(`expected ${show(actual)} ${negate ? 'not ' : ''}${what}`);
  };
  const m = {
    toBe: (e: unknown) => check(Object.is(actual, e), `to be ${show(e)}`),
    toEqual: (e: unknown) => check(equal(actual, e), `to equal ${show(e)}`),
    toBeNull: () => check(actual === null, 'to be null'),
    toContain: (e: unknown) => check((actual as { includes(x: unknown): boolean }).includes(e), `to contain ${show(e)}`),
    toHaveLength: (n: number) => check((actual as { length: number }).length === n, `to have length ${n}`),
    toMatch: (r: RegExp | string) => check(typeof r === 'string' ? String(actual).includes(r) : r.test(String(actual)), `to match ${r}`),
    toMatchObject: (e: unknown) => check(subset(actual, e), `to match object ${show(e)}`),
    toThrow: (e?: RegExp | string) => {
      let threw = false, msg = '';
      try { (actual as () => unknown)(); } catch (err) { threw = true; msg = (err as Error).message; }
      const ok = threw && (!e || (typeof e === 'string' ? msg.includes(e) : e.test(msg)));
      check(ok, `to throw${e ? ` ${e}` : ''}`);
    },
  };
  return m;
}
g.expect = Object.assign((actual: unknown) => Object.assign(makeExpect(actual), { not: makeExpect(actual, true) }), {
  objectContaining: (o: Record<string, unknown>) => new Partial_(o),
  arrayContaining: (a: unknown[]) => new Contains_(a),
});

/** Spec files that need NestJS or Prisma are skipped here; real Jest runs them. */
const NEEDS_FRAMEWORK = /from '\.\/[\w.-]+\.service'|@nestjs|generated\/prisma/;
const root = join(__dirname, '..', '..');
const found: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.spec.ts')) found.push(p);
  }
};
walk(join(root, 'backend', 'src'));
walk(join(root, 'shared', 'src'));
walk(join(root, 'scripts', 'qa'));

(async () => {
  const skipped: string[] = [];
  for (const file of found.sort()) {
    if (NEEDS_FRAMEWORK.test(readFileSync(file, 'utf8'))) { skipped.push(relative(root, file)); continue; }
    const before = tests.length;
    stack.push(relative(root, file));
    require(file);
    stack.pop();
    if (tests.length === before) skipped.push(`${relative(root, file)} (no tests found)`);
  }
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); } catch (err) { failed++; console.log(`FAIL ${t.name}\n     ${(err as Error).message}`); }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed, from ${found.length - skipped.length} spec files`);
  if (skipped.length) console.log(`Skipped (need NestJS or Prisma, run with Jest): ${skipped.join(', ')}`);
  process.exit(failed ? 1 : 0);
})();
