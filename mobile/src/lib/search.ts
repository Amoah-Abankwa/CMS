/**
 * Search help for when nothing matches: fix a likely typo ("algorthm" -> "algorithm") from the words
 * that do appear in the list, so the screen can offer the corrected search.
 */
export function editDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** The words of the searchable texts, lower case, at least 3 letters. */
export function vocabulary(texts: string[]) {
  const words = new Set<string>();
  for (const t of texts) for (const w of t.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) words.add(w);
  return [...words];
}

/** The query with each unknown word replaced by the closest known word, or null if nothing improves. */
export function didYouMean(query: string, words: string[]): string | null {
  const parts = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  let changed = false;
  const fixed = parts.map((p) => {
    if (words.includes(p) || words.some((w) => w.startsWith(p))) return p;
    const limit = p.length <= 4 ? 1 : 2;
    let best: { w: string; d: number } | null = null;
    for (const w of words) {
      const d = editDistance(p, w);
      if (d <= limit && (!best || d < best.d)) best = { w, d };
    }
    if (best) {
      changed = true;
      return best.w;
    }
    return p;
  });
  return changed ? fixed.join(' ') : null;
}

export function matches(text: string, query: string) {
  const t = text.toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every((p) => t.includes(p));
}
