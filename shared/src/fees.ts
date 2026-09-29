/** School fees and departmental dues (added after Phase 10). Money in pesewas. */

export type Currency = 'GHS' | 'USD';
export type FeeStudentGroup = 'ALL' | 'GHANAIAN' | 'INTERNATIONAL';
export const STUDENT_GROUP_LABEL: Record<FeeStudentGroup, string> = { ALL: 'All students', GHANAIAN: 'Ghanaian students', INTERNATIONAL: 'International students' };

/** Ghanaian unless the student's recorded nationality says otherwise. */
export function studentGroupOf(nationality: string | null | undefined): Exclude<FeeStudentGroup, 'ALL'> {
  const n = (nationality ?? '').trim().toLowerCase();
  return n === '' || n === 'ghanaian' || n === 'ghana' ? 'GHANAIAN' : 'INTERNATIONAL';
}

/** Money in the smallest unit (pesewas or cents). */
export function formatMoney(amount: number, currency: Currency) {
  const sign = amount < 0 ? '-' : '';
  const value = (Math.abs(amount) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency === 'USD' ? 'US$' : 'GH₵'} ${value}`;
}

export interface FeeScheduleMatch {
  id: string;
  programmeId: string | null;
  level: number | null;
  studentGroup?: FeeStudentGroup;
}

/**
 * The schedule that applies to a student: the most specific one wins. A schedule for the student's
 * programme and level beats one for the programme, which beats one for the level, which beats one
 * for everybody. Returns null when nothing applies.
 */
export function pickSchedule<T extends FeeScheduleMatch>(schedules: T[], student: { programmeId: string; level: number; group?: Exclude<FeeStudentGroup, 'ALL'> }): T | null {
  const score = (s: T) => {
    if (s.programmeId && s.programmeId !== student.programmeId) return -1;
    if (s.level !== null && s.level !== student.level) return -1;
    const g = s.studentGroup ?? 'ALL';
    if (g !== 'ALL' && g !== (student.group ?? 'GHANAIAN')) return -1;
    return (s.programmeId ? 4 : 0) + (s.level !== null ? 2 : 0) + (g !== 'ALL' ? 1 : 0);
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
  return a.id !== b.id && a.programmeId === b.programmeId && a.level === b.level && (a.studentGroup ?? 'ALL') === (b.studentGroup ?? 'ALL');
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
  /** Percentage of the semester's bill a student must have paid to be cleared for exams. Set by the Registrar. */
  clearancePercent: number;
  /** Smallest online payment accepted on a cedi bill, so card and MoMo charges stay reasonable. Set by Finance. */
  minOnlinePayment: number;
  /** The same for bills in US dollars (cents). */
  minOnlinePaymentUsd: number;
  /** Late payment charges: off unless the Finance Office turns them on. */
  lateFeeEnabled: boolean;
  /** Charged once for each instalment missed: pesewas on cedi bills, cents on dollar bills. */
  lateFee: number;
  lateFeeUsd: number;
}
export const DEFAULT_FEE_RULES: FeeRules = { clearancePercent: 70, minOnlinePayment: 5000, minOnlinePaymentUsd: 1000, lateFeeEnabled: false, lateFee: 5000, lateFeeUsd: 500 };

export function validateFeeRules(r: FeeRules): string[] {
  const p: string[] = [];
  if (!(r.clearancePercent >= 1 && r.clearancePercent <= 100)) p.push('The clearance percentage must be between 1 and 100.');
  if (!(r.minOnlinePayment >= 100 && r.minOnlinePayment <= 500_000)) p.push('The smallest online payment must be between GH₵ 1.00 and GH₵ 5,000.00.');
  if (!(r.minOnlinePaymentUsd >= 100 && r.minOnlinePaymentUsd <= 100_000)) p.push('The smallest dollar payment must be between US$ 1.00 and US$ 1,000.00.');
  const lf = r.lateFee ?? 0, lfu = r.lateFeeUsd ?? 0;
  if (!(lf >= 0 && lf <= 1_000_000) || !(lfu >= 0 && lfu <= 100_000)) p.push('The late payment charge is out of range.');
  return p;
}

export type FeePaymentMethod = 'ONLINE' | 'BANK' | 'MOBILE_MONEY' | 'CHEQUE';
export const FEE_METHOD_LABEL: Record<FeePaymentMethod, string> = { ONLINE: 'Online (Paystack)', BANK: 'Bank deposit', MOBILE_MONEY: 'Mobile money to the university', CHEQUE: 'Cheque' };

export interface StatementEntry {
  date: string;
  description: string;
  /** Charges: what the student owes. */
  debit: number;
  /** Payments and waivers: what reduces it. */
  credit: number;
  balance: number;
  receipt?: string;
}

/**
 * A statement for one bill: the bill's items as debits, payments and waivers as credits, extra
 * charges and reversed payments as debits, in date order with a running balance.
 */
export function feeStatement(bill: {
  issuedAt: string | Date;
  lines: Array<{ name: string; amount: number }>;
  adjustments: Array<{ amount: number; reason: string; createdAt: string | Date }>;
  payments: Array<{ amount: number; method: FeePaymentMethod; receiptNumber: string; paidOn: string | Date; reversedAt: string | Date | null; reversalReason: string | null }>;
}): StatementEntry[] {
  const iso = (d: string | Date) => new Date(d).toISOString();
  const raw: Array<Omit<StatementEntry, 'balance'> & { order: number }> = [];
  bill.lines.forEach((l, i) => raw.push({ date: iso(bill.issuedAt), description: l.name, debit: l.amount, credit: 0, order: i }));
  for (const a of bill.adjustments) raw.push({ date: iso(a.createdAt), description: a.reason, debit: a.amount > 0 ? a.amount : 0, credit: a.amount < 0 ? -a.amount : 0, order: 100 });
  for (const p of bill.payments) {
    raw.push({ date: iso(p.paidOn), description: `Payment: ${FEE_METHOD_LABEL[p.method]}`, debit: 0, credit: p.amount, receipt: p.receiptNumber, order: 200 });
    if (p.reversedAt) raw.push({ date: iso(p.reversedAt), description: `Payment reversed: ${p.reversalReason ?? ''}`.trim(), debit: p.amount, credit: 0, receipt: p.receiptNumber, order: 300 });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  let balance = 0;
  return raw.map(({ order: _order, ...e }) => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });
}

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

// ----- Exchange rates (set by the Accounts office) -----

/**
 * Converts money between cedis and dollars at a rate given as cedis per US dollar (e.g. 15.25).
 * Amounts are in the smallest unit (pesewas or cents) and rounded to the nearest one.
 */
export function convertMoney(amount: number, from: Currency, to: Currency, cedisPerDollar: number): number {
  if (from === to) return amount;
  if (!(cedisPerDollar > 0)) throw new Error('No exchange rate is set.');
  return from === 'USD' ? Math.round(amount * cedisPerDollar) : Math.round(amount / cedisPerDollar);
}

/** The rate in force at a moment: the latest one that has taken effect. */
export function rateAt<T extends { effectiveFrom: Date | string; cedisPerDollar: number }>(rates: T[], at = new Date()): T | null {
  return rates.filter((r) => new Date(r.effectiveFrom) <= at).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0] ?? null;
}

// ----- Campus dispatcher fee -----

export type DispatchFeeMode = 'INCLUDED' | 'ON_DELIVERY';
export type DispatchFeeSettlement = 'UNIVERSITY' | 'VENDOR' | 'CUSTOMER';

/**
 * Who hands the dispatcher their fee. Included in a Paystack payment: the university holds it and
 * Finance pays it out. Included in MoMo or cash paid to the vendor: the vendor hands it over at pickup.
 * On delivery: the customer pays the dispatcher directly.
 */
export function dispatchFeeSettlement(mode: DispatchFeeMode, payment: 'ONLINE' | 'ON_PICKUP'): DispatchFeeSettlement {
  if (mode === 'ON_DELIVERY') return 'CUSTOMER';
  return payment === 'ONLINE' ? 'UNIVERSITY' : 'VENDOR';
}

// ----- Instalments -----

/** A semester's instalment plan: by each date, at least this share of the bill must be paid (rising to 100). */
export interface Instalment { dueDate: string; cumulativePercent: number }

export function instalmentPlanProblem(plan: Instalment[]): string | null {
  if (!plan.length) return 'Add at least one instalment.';
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)) return 'Each instalment needs a date.';
    if (!(p.cumulativePercent > 0 && p.cumulativePercent <= 100)) return 'Each share must be between 1% and 100%.';
    if (i > 0 && (p.dueDate <= plan[i - 1].dueDate || p.cumulativePercent <= plan[i - 1].cumulativePercent)) return 'Dates and shares must both go up from one instalment to the next.';
  }
  if (plan[plan.length - 1].cumulativePercent !== 100) return 'The last instalment must bring the total to 100%.';
  return null;
}

/**
 * Where a bill stands against the plan on a day: the next instalment and what must be paid by then,
 * and every instalment whose date has passed without enough paid.
 */
export function instalmentStatus(due: number, paid: number, plan: Instalment[], today: string) {
  const need = (p: Instalment) => Math.ceil((due * p.cumulativePercent) / 100);
  const missed = plan.map((p, i) => ({ ...p, index: i, required: need(p) })).filter((p) => p.dueDate < today && paid < p.required);
  const next = plan.map((p, i) => ({ ...p, index: i, required: need(p) })).find((p) => p.dueDate >= today && paid < p.required) ?? null;
  return { missed, next: next ? { ...next, toPay: next.required - paid } : null };
}

// ----- Bank statements -----

/** Index numbers mentioned in a bank narration (e.g. "FEES ANU25400001 AMA MENSAH"). */
export function indexNumbersIn(narration: string): string[] {
  const found = narration.toUpperCase().match(/\b[A-Z]{1,6}[/-]?\d{2}[/-]?[A-Z0-9]{0,4}[/-]?\d{3,6}\b/g) ?? [];
  return [...new Set(found.filter((t) => /\d{5,}/.test(t.replace(/[^0-9]/g, ''))))];
}
