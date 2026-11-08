/**
 * Opening hours as one line per day ("07:00-15:00", "07:00-11:00, 16:00-21:00", or empty for closed),
 * converted to and from the stored form (weekday 0 Sunday to 6 Saturday, a list of [open, close]).
 */
export type OpeningHours = Record<string, Array<[string, string]>>;
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function hoursToText(h: OpeningHours, day: number) {
  return (h[String(day)] ?? []).map(([a, b]) => `${a}-${b}`).join(', ');
}

/** The day's periods, or a message saying how to write them. */
export function parseDay(text: string): { periods: Array<[string, string]>; problem: string | null } {
  const t = text.trim();
  if (!t) return { periods: [], problem: null };
  const periods: Array<[string, string]> = [];
  for (const part of t.split(',')) {
    const m = /^\s*([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)\s*$/.exec(part);
    if (!m) return { periods: [], problem: 'Write times like 07:00-15:00, with a comma between periods. Leave empty if closed.' };
    const open = `${m[1]}:${m[2]}`;
    const close = `${m[3]}:${m[4]}`;
    if (close <= open) return { periods: [], problem: `${open}-${close}: closing must be after opening.` };
    periods.push([open, close]);
  }
  return { periods, problem: null };
}
