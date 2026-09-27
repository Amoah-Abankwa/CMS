/**
 * Pure exam rules: timetable clash detection and eligibility decisions.
 * Shared by the API (which enforces them) and the web app (which previews them).
 */

export interface ScheduledPaper {
  sessionId: string;
  offeringId: string;
  label: string;
  start: Date;
  end: Date;
  venueId: string | null;
  venueName?: string | null;
  venueCapacity: number | null;
  invigilatorIds: string[];
}

export type TimetableIssue =
  | { kind: 'STUDENT_CLASH'; severity: 'error'; sessionIds: [string, string]; students: number; message: string }
  | { kind: 'VENUE_OVER_CAPACITY'; severity: 'error'; sessionIds: string[]; venueId: string; seatsNeeded: number; capacity: number; message: string }
  | { kind: 'INVIGILATOR_CLASH'; severity: 'error'; sessionIds: [string, string]; userId: string; message: string }
  | { kind: 'NO_VENUE'; severity: 'warning'; sessionIds: [string]; message: string }
  | { kind: 'UNSCHEDULED'; severity: 'warning'; offeringId: string; message: string };

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Finds problems in a timetable.
 * - A student cannot sit two papers that overlap.
 * - Several papers may share a hall, but the students present at any moment must fit its seats.
 * - An invigilator cannot supervise two overlapping papers.
 * @param enrolled approved students per offering
 * @param offeringsNeedingPapers offerings with approved students, used to report unscheduled papers
 */
export function findTimetableIssues(
  papers: ScheduledPaper[],
  enrolled: Map<string, Set<string>>,
  offeringsNeedingPapers: Array<{ offeringId: string; label: string }> = [],
): TimetableIssue[] {
  const issues: TimetableIssue[] = [];
  const sorted = [...papers].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.start >= a.end) break; // sorted by start: nothing later can overlap a
      const sa = enrolled.get(a.offeringId) ?? new Set<string>();
      const sb = enrolled.get(b.offeringId) ?? new Set<string>();
      let shared = 0;
      for (const s of sa) if (sb.has(s)) shared++;
      if (shared > 0) {
        issues.push({
          kind: 'STUDENT_CLASH', severity: 'error', sessionIds: [a.sessionId, b.sessionId], students: shared,
          message: `${a.label} and ${b.label} overlap, and ${shared} ${shared === 1 ? 'student takes' : 'students take'} both.`,
        });
      }
      for (const u of a.invigilatorIds) {
        if (b.invigilatorIds.includes(u)) {
          issues.push({ kind: 'INVIGILATOR_CLASH', severity: 'error', sessionIds: [a.sessionId, b.sessionId], userId: u, message: `The same invigilator is assigned to ${a.label} and ${b.label}, which overlap.` });
        }
      }
    }
  }

  // Venue load: check at every paper's start, which is when the number present can rise.
  const byVenue = new Map<string, ScheduledPaper[]>();
  for (const p of papers) {
    if (!p.venueId) {
      issues.push({ kind: 'NO_VENUE', severity: 'warning', sessionIds: [p.sessionId], message: `${p.label} has no venue yet.` });
      continue;
    }
    if (!byVenue.has(p.venueId)) byVenue.set(p.venueId, []);
    byVenue.get(p.venueId)!.push(p);
  }
  for (const [venueId, list] of byVenue) {
    const capacity = list[0].venueCapacity;
    if (capacity === null) continue;
    const reported = new Set<string>();
    for (const p of list) {
      const present = list.filter((q) => q.start <= p.start && p.start < q.end);
      const seats = present.reduce((s, q) => s + (enrolled.get(q.offeringId)?.size ?? 0), 0);
      const key = present.map((q) => q.sessionId).sort().join('|');
      if (seats > capacity && !reported.has(key)) {
        reported.add(key);
        issues.push({
          kind: 'VENUE_OVER_CAPACITY', severity: 'error', sessionIds: present.map((q) => q.sessionId), venueId, seatsNeeded: seats, capacity,
          message: `${list[0].venueName ?? 'A venue'} needs ${seats} seats for ${present.map((q) => q.label).join(' and ')} but has ${capacity}.`,
        });
      }
    }
  }

  const scheduled = new Set(papers.map((p) => p.offeringId));
  for (const o of offeringsNeedingPapers) {
    if (!scheduled.has(o.offeringId)) issues.push({ kind: 'UNSCHEDULED', severity: 'warning', offeringId: o.offeringId, message: `${o.label} has no exam scheduled.` });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Eligibility

export const HOLD_CATEGORIES = {
  DISCIPLINARY: 'Disciplinary hold (Dean of Students)',
  ACADEMIC_MISCONDUCT: 'Academic misconduct hold (Examinations Office)',
  ADMINISTRATIVE: 'Administrative hold (Registry)',
  OTHER: 'Hold (contact the Examinations Office)',
} as const;
export type HoldCategory = keyof typeof HOLD_CATEGORIES;

/** Reason codes stored with each decision. Text shown to students comes from ELIGIBILITY_REASON_TEXT. */
export type EligibilityReason = 'FEES_NOT_CLEARED' | 'LOW_ATTENDANCE' | `HOLD_${HoldCategory}` | 'OVERRIDE';

export const ELIGIBILITY_REASON_TEXT: Record<EligibilityReason, string> = {
  FEES_NOT_CLEARED: 'Fees not cleared with the Finance Office',
  LOW_ATTENDANCE: 'Class attendance below the required minimum',
  HOLD_DISCIPLINARY: HOLD_CATEGORIES.DISCIPLINARY,
  HOLD_ACADEMIC_MISCONDUCT: HOLD_CATEGORIES.ACADEMIC_MISCONDUCT,
  HOLD_ADMINISTRATIVE: HOLD_CATEGORIES.ADMINISTRATIVE,
  HOLD_OTHER: HOLD_CATEGORIES.OTHER,
  OVERRIDE: 'Decision of the Examinations Office',
};

export interface EligibilityPolicy {
  requireFinancialClearance: boolean;
  /** Apply the attendance minimum from the attendance rules. */
  requireMinimumAttendance: boolean;
}

export interface EligibilityInput {
  feesCleared: boolean;
  /** Active holds: offeringId null means all papers. */
  holds: Array<{ offeringId: string | null; category: HoldCategory }>;
  /** Attendance percentage in this course; null when no classes have been recorded yet. */
  attendancePercent?: number | null;
  minimumAttendancePercent?: number;
}

/** Decides one student's eligibility for one paper from the rules. Overrides are applied separately. */
export function decideEligibility(offeringId: string, input: EligibilityInput, policy: EligibilityPolicy) {
  const reasons: EligibilityReason[] = [];
  if (policy.requireFinancialClearance && !input.feesCleared) reasons.push('FEES_NOT_CLEARED');
  if (
    policy.requireMinimumAttendance &&
    input.attendancePercent !== null && input.attendancePercent !== undefined &&
    input.minimumAttendancePercent !== undefined &&
    input.attendancePercent < input.minimumAttendancePercent
  ) {
    reasons.push('LOW_ATTENDANCE');
  }
  for (const h of input.holds) {
    if (h.offeringId === null || h.offeringId === offeringId) {
      const code = `HOLD_${h.category}` as EligibilityReason;
      if (!reasons.includes(code)) reasons.push(code);
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

/** One-line summary for notifications. Never names the reason, since SMS can be read by others. */
export function eligibilitySummary(total: number, notEligible: number) {
  if (notEligible === 0) return `Eligible for all ${total} ${total === 1 ? 'paper' : 'papers'}`;
  if (notEligible === total) return `Not eligible for any of your ${total} ${total === 1 ? 'paper' : 'papers'}`;
  return `Not eligible for ${notEligible} of ${total} papers`;
}
