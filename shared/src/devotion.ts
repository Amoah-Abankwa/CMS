/**
 * Morning devotion rules, shared by backend and frontend.
 * Ghana is on UTC all year (no daylight saving), so clock times are converted as UTC.
 */

export type DevotionStatus = 'EARLY' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface DevotionPolicy {
  /** Days of the week with devotion: 0 Sunday to 6 Saturday. */
  days: number[];
  /** Check-in opens (arriving before the start counts as early). */
  opensAt: string;
  startsAt: string;
  /** Arriving at or after this time is late. */
  lateFrom: string;
  /** Arriving at or after this time is absent. */
  endsAt: string;
  /** Semester total when a student is early for every service. */
  totalMarks: number;
  /** Share of a service's marks earned for arriving late: 0 to just under 1. */
  lateCredit: number;
}

export const DEFAULT_DEVOTION_POLICY: DevotionPolicy = {
  days: [1, 2, 4, 5],
  opensAt: '07:00',
  startsAt: '07:30',
  lateFrom: '07:50',
  endsAt: '08:00',
  totalMarks: 5,
  lateCredit: 0.5,
};

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function validateDevotionPolicy(p: DevotionPolicy): string[] {
  const problems: string[] = [];
  if (!p.days.length) problems.push('Choose at least one day.');
  if (p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) problems.push('Days must be days of the week.');
  const times = [p.opensAt, p.startsAt, p.lateFrom, p.endsAt];
  if (times.some((t) => !TIME.test(t))) problems.push('Times must look like 07:30.');
  else {
    if (minutes(p.opensAt) > minutes(p.startsAt)) problems.push('Check-in must open at or before the start.');
    if (minutes(p.startsAt) >= minutes(p.lateFrom)) problems.push('Late must begin after the start.');
    if (minutes(p.lateFrom) >= minutes(p.endsAt)) problems.push('Devotion must end after late begins.');
  }
  if (!(p.totalMarks > 0 && p.totalMarks <= 100)) problems.push('The semester total must be between 0 and 100.');
  if (!(p.lateCredit >= 0 && p.lateCredit < 1)) problems.push('Late must earn less than early: choose a share from 0 up to, but not including, 1.');
  return problems;
}

/** Clock times for a service on a date (YYYY-MM-DD). */
export function devotionTimes(date: string, p: Pick<DevotionPolicy, 'opensAt' | 'startsAt' | 'lateFrom' | 'endsAt'>) {
  const at = (t: string) => new Date(`${date}T${t}:00Z`);
  return { opensAt: at(p.opensAt), startsAt: at(p.startsAt), lateFrom: at(p.lateFrom), endsAt: at(p.endsAt) };
}

/** Status for an arrival time. Before check-in opens or after the end, there is no status to record. */
export function devotionStatusAt(
  times: { opensAt: Date; lateFrom: Date; endsAt: Date },
  at: Date,
): { status: 'EARLY' | 'LATE' } | { error: 'NOT_OPEN' | 'ENDED' } {
  if (at < times.opensAt) return { error: 'NOT_OPEN' };
  if (at >= times.endsAt) return { error: 'ENDED' };
  return { status: at < times.lateFrom ? 'EARLY' : 'LATE' };
}

/**
 * Semester score out of totalMarks. Early earns a full share, late earns lateCredit of a share,
 * absent earns nothing. Excused services are left out, so they never lower the score.
 */
export function devotionScore(statuses: DevotionStatus[], p: Pick<DevotionPolicy, 'totalMarks' | 'lateCredit'>) {
  const early = statuses.filter((s) => s === 'EARLY').length;
  const late = statuses.filter((s) => s === 'LATE').length;
  const absent = statuses.filter((s) => s === 'ABSENT').length;
  const excused = statuses.filter((s) => s === 'EXCUSED').length;
  const counted = early + late + absent;
  const score = counted === 0 ? null : Math.round(((early + late * p.lateCredit) / counted) * p.totalMarks * 100) / 100;
  return { early, late, absent, excused, counted, score };
}

/** Service dates (YYYY-MM-DD) on the chosen weekdays between two dates, inclusive. */
export function serviceDates(from: Date, to: Date, days: number[]): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (d.getTime() <= end) {
    if (days.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
