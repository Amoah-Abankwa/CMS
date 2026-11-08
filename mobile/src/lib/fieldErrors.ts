/** "email must be an email" -> { email: 'must be an email' }: lets forms flag the exact field. */
export function fieldErrors(details?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details ?? []) {
    const m = /^(\w+)\s+(.*)$/.exec(d);
    if (m && !out[m[1]]) out[m[1]] = m[2];
  }
  return out;
}
