/** School fees and departmental dues (added after Phase 10). Money in pesewas. */

export interface FeeScheduleMatch {
  id: string;
  programmeId: string | null;
  level: number | null;
}

/**
 * The schedule that applies to a student: the most specific one wins. A schedule for the student's
 * programme and level beats one for the programme, which beats one for the level, which beats one
 * for everybody. Returns null when nothing applies.
 */
export function pickSchedule<T extends FeeScheduleMatch>(schedules: T[], student: { programmeId: string; level: number }): T | null {
  const score = (s: T) => {
    if (s.programmeId && s.programmeId !== student.programmeId) return -1;
    if (s.level !== null && s.level !== student.level) return -1;
    return (s.programmeId ? 2 : 0) + (s.level !== null ? 1 : 0);
  };
  let best: T | null = null;
  let bestScore = -1;
  for (const s of schedules) {
    const sc = score(s);
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return best;
}

/** Two schedules for the same programme and level in one semester would make billing ambiguous. */
export function scheduleClash(a: FeeScheduleMatch, b: FeeScheduleMatch) {
  return a.id !== b.id && a.programmeId === b.programmeId && a.level === b.level;
}

export interface BillFigures {
  /** Total of the schedule lines when the bill was issued. */
  charged: number;
  /** Scholarships and waivers are negative; extra charges positive. */
  adjustments: number;
  /** Payments not reversed. */
  paid: number;
}

export function billBalance(b: BillFigures) {
  const due = Math.max(0, b.charged + b.adjustments);
  const balance = due - b.paid;
  /** Percentage of what is due that has been paid, rounded down so 69.99% never shows as 70%. */
  const percentPaid = due === 0 ? 100 : Math.min(100, Math.floor((b.paid / due) * 10000) / 100);
  return { due, balance, percentPaid, overpaid: balance < 0 ? -balance : 0 };
}

export type ClearanceSource = 'MANUAL' | 'FEES';

/**
 * What automatic fee clearance should do after a payment, reversal or adjustment. A decision
 * Finance made by hand is never overridden. Returns null when nothing should change.
 */
export function feeClearanceChange(
  current: { cleared: boolean; source: ClearanceSource } | null,
  percentPaid: number,
  thresholdPercent: number,
): { cleared: boolean } | null {
  if (current?.source === 'MANUAL') return null;
  const shouldClear = percentPaid + 1e-9 >= thresholdPercent;
  if (!current) return shouldClear ? { cleared: true } : null;
  return current.cleared === shouldClear ? null : { cleared: shouldClear };
}

export interface FeeRules {
  /** Percentage of the semester's bill a student must have paid to be cleared for exams. */
  clearancePercent: number;
  /** Smallest online payment accepted, so card and MoMo charges stay reasonable. */
  minOnlinePayment: number;
}
export const DEFAULT_FEE_RULES: FeeRules = { clearancePercent: 70, minOnlinePayment: 5000 };

export function validateFeeRules(r: FeeRules): string[] {
  const p: string[] = [];
  if (!(r.clearancePercent >= 1 && r.clearancePercent <= 100)) p.push('The clearance percentage must be between 1 and 100.');
  if (!(r.minOnlinePayment >= 100 && r.minOnlinePayment <= 500_000)) p.push('The smallest online payment must be between GH₵ 1.00 and GH₵ 5,000.00.');
  return p;
}

export type FeePaymentMethod = 'ONLINE' | 'BANK' | 'MOBILE_MONEY' | 'CHEQUE';
export const FEE_METHOD_LABEL: Record<FeePaymentMethod, string> = { ONLINE: 'Online (Paystack)', BANK: 'Bank deposit', MOBILE_MONEY: 'Mobile money to the university', CHEQUE: 'Cheque' };

// ----- Departmental dues -----

export type AssociationOffice = 'PRESIDENT' | 'TREASURER';
export const OFFICE_LABEL: Record<AssociationOffice, string> = { PRESIDENT: 'President', TREASURER: 'Treasurer' };

/** Receipt numbers per association, e.g. EHASSA-000123. */
export function receiptNumber(prefix: string, sequence: number) {
  return `${prefix.toUpperCase()}-${String(sequence).padStart(6, '0')}`;
}

/** Short association codes such as EHASSA or BACA: 2 to 10 capital letters or digits. */
export function validAssociationCode(code: string) {
  return /^[A-Z][A-Z0-9]{1,9}$/.test(code);
}

/** Whether an officer's term covers a moment. Terms end at the end of their last day. */
export function termActive(term: { startsOn: Date; endsOn: Date; endedAt: Date | null }, at = new Date()) {
  if (term.endedAt && term.endedAt <= at) return false;
  const end = new Date(term.endsOn);
  end.setUTCHours(23, 59, 59, 999);
  return term.startsOn <= at && at <= end;
}
