/**
 * Library rules shared by backend and frontend. Money is in pesewas (GH₵ 1.00 = 100).
 * Ghana is on UTC all year, so "end of the day" is 23:59:59 UTC.
 */

export type BorrowerKind = 'STUDENT' | 'STAFF';

export interface LoanRules {
  loanDays: number;
  maxItems: number;
  maxRenewals: number;
}

export interface LibraryPolicy {
  student: LoanRules;
  staff: LoanRules;
  /** Fine per full day overdue, in pesewas. 0 turns fines off. */
  finePerDay: number;
  /** Days after the due date before fines start. */
  graceDays: number;
  /** Most a single overdue book can be fined, in pesewas. */
  maxFinePerItem: number;
  /** Borrowing stops when unpaid fines reach this, in pesewas. */
  blockAtFines: number;
  /** Charged when a book is declared lost, in pesewas. */
  lostItemFee: number;
  /** Days a returned copy is kept for the next reservation. */
  holdDays: number;
  /** Most reservations a borrower can have waiting. */
  maxReservations: number;
  /** Reminder this many days before a book is due. */
  dueReminderDays: number;
  /** Days the library is closed (0 Sunday to 6 Saturday); due dates move to the next open day. */
  closedDays: number[];
}

export const DEFAULT_LIBRARY_POLICY: LibraryPolicy = {
  student: { loanDays: 14, maxItems: 4, maxRenewals: 2 },
  staff: { loanDays: 30, maxItems: 10, maxRenewals: 3 },
  finePerDay: 100,
  graceDays: 0,
  maxFinePerItem: 5000,
  blockAtFines: 2000,
  lostItemFee: 15000,
  holdDays: 3,
  maxReservations: 3,
  dueReminderDays: 2,
  closedDays: [0],
};

export function validateLibraryPolicy(p: LibraryPolicy): string[] {
  const problems: string[] = [];
  for (const [who, r] of [['Students', p.student], ['Staff', p.staff]] as const) {
    if (!(r.loanDays >= 1 && r.loanDays <= 180)) problems.push(`${who}: loan length must be 1 to 180 days.`);
    if (!(r.maxItems >= 1 && r.maxItems <= 50)) problems.push(`${who}: books at a time must be 1 to 50.`);
    if (!(r.maxRenewals >= 0 && r.maxRenewals <= 10)) problems.push(`${who}: renewals must be 0 to 10.`);
  }
  if (p.finePerDay < 0 || p.maxFinePerItem < 0 || p.blockAtFines < 0 || p.lostItemFee < 0) problems.push('Amounts cannot be negative.');
  if (p.finePerDay > 0 && p.maxFinePerItem > 0 && p.maxFinePerItem < p.finePerDay) problems.push('The most one book can be fined must be at least one day of fines.');
  if (!(p.graceDays >= 0 && p.graceDays <= 30)) problems.push('Grace days must be 0 to 30.');
  if (!(p.holdDays >= 1 && p.holdDays <= 14)) problems.push('Reserved books must be kept 1 to 14 days.');
  if (!(p.maxReservations >= 0 && p.maxReservations <= 10)) problems.push('Reservations must be 0 to 10.');
  if (!(p.dueReminderDays >= 0 && p.dueReminderDays <= 14)) problems.push('The reminder must be 0 to 14 days before.');
  if (p.closedDays.length >= 7 || p.closedDays.some((d) => d < 0 || d > 6)) problems.push('The library must be open at least one day a week.');
  return problems;
}

const DAY = 86_400_000;
const endOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));

/** Due at the end of the day, loanDays after issue, moved forward past closed days. */
export function dueDate(from: Date, loanDays: number, closedDays: number[]): Date {
  let due = endOfDay(new Date(from.getTime() + loanDays * DAY));
  for (let i = 0; i < 7 && closedDays.includes(due.getUTCDay()); i++) due = new Date(due.getTime() + DAY);
  return due;
}

/** Whole days late, counted in calendar days after the due date. */
export function daysOverdue(due: Date, at: Date): number {
  if (at <= due) return 0;
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const atDay = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.max(0, Math.round((atDay - dueDay) / DAY));
}

export function overdueFine(due: Date, at: Date, p: Pick<LibraryPolicy, 'finePerDay' | 'graceDays' | 'maxFinePerItem'>): number {
  const days = daysOverdue(due, at);
  if (days <= p.graceDays || p.finePerDay === 0) return 0;
  const fine = days * p.finePerDay;
  return p.maxFinePerItem > 0 ? Math.min(fine, p.maxFinePerItem) : fine;
}

export type BorrowBlock = 'LIMIT_REACHED' | 'HAS_OVERDUE' | 'FINES_OWED';

export const BORROW_BLOCK_TEXT: Record<BorrowBlock, string> = {
  LIMIT_REACHED: 'Already has the most books allowed at one time',
  HAS_OVERDUE: 'Has overdue books to return first',
  FINES_OWED: 'Owes library fines at or above the limit',
};

export function borrowBlocks(input: { activeLoans: number; overdueLoans: number; finesOwed: number }, rules: LoanRules, p: Pick<LibraryPolicy, 'blockAtFines'>): BorrowBlock[] {
  const blocks: BorrowBlock[] = [];
  if (input.activeLoans >= rules.maxItems) blocks.push('LIMIT_REACHED');
  if (input.overdueLoans > 0) blocks.push('HAS_OVERDUE');
  if (p.blockAtFines > 0 && input.finesOwed >= p.blockAtFines) blocks.push('FINES_OWED');
  return blocks;
}

export type RenewBlock = 'OVERDUE' | 'NO_RENEWALS_LEFT' | 'RESERVED';

export const RENEW_BLOCK_TEXT: Record<RenewBlock, string> = {
  OVERDUE: 'It is overdue. Return it at the desk.',
  NO_RENEWALS_LEFT: 'It has been renewed the most times allowed.',
  RESERVED: 'Someone else has reserved it.',
};

export function renewBlock(loan: { dueAt: Date; renewals: number }, reservedByOthers: boolean, rules: LoanRules, now: Date): RenewBlock | null {
  if (now > loan.dueAt) return 'OVERDUE';
  if (loan.renewals >= rules.maxRenewals) return 'NO_RENEWALS_LEFT';
  if (reservedByOthers) return 'RESERVED';
  return null;
}

// ----- Graduation clearance -----

/**
 * Whether a student is clear with the library for graduation: every book returned, no fines owed, and
 * any lost book paid for. Returns the plain reasons when not.
 */
export function libraryClearance(s: { booksOut: number; interLibraryOut: number; finesOwed: number }) {
  const reasons: string[] = [];
  if (s.booksOut) reasons.push(`${s.booksOut} book${s.booksOut === 1 ? '' : 's'} still out. Return ${s.booksOut === 1 ? 'it' : 'them'} to the library.`);
  if (s.interLibraryOut) reasons.push(`${s.interLibraryOut} inter-library loan${s.interLibraryOut === 1 ? '' : 's'} still out.`);
  if (s.finesOwed > 0) reasons.push(`GH₵ ${(s.finesOwed / 100).toFixed(2)} in library fines to pay.`);
  return { clear: reasons.length === 0, reasons };
}

// ----- Inter-library loans -----

export type IllStatus = 'REQUESTED' | 'ORDERED' | 'ARRIVED' | 'ON_LOAN' | 'RETURNED' | 'REJECTED' | 'CANCELLED';
export const ILL_STATUS_LABEL: Record<IllStatus, string> = {
  REQUESTED: 'Requested', ORDERED: 'Ordered from the other library', ARRIVED: 'Arrived: collect at the desk', ON_LOAN: 'With you', RETURNED: 'Returned', REJECTED: 'Could not be obtained', CANCELLED: 'Cancelled',
};

/** Steps the Librarian can take; a member can only cancel a request not yet ordered. */
export function illNext(from: IllStatus): IllStatus[] {
  const map: Record<IllStatus, IllStatus[]> = {
    REQUESTED: ['ORDERED', 'REJECTED'], ORDERED: ['ARRIVED', 'REJECTED'], ARRIVED: ['ON_LOAN', 'RETURNED'], ON_LOAN: ['RETURNED'], RETURNED: [], REJECTED: [], CANCELLED: [],
  };
  return map[from];
}

// ----- Reading lists -----

/** Essential titles short of copies for the number of students: fewer than one copy per `perCopy` students, and no e-book. */
export function readingShortfall(o: { students: number; copies: number; hasEbook: boolean; perCopy?: number }) {
  if (o.hasEbook || o.students === 0) return 0;
  const needed = Math.ceil(o.students / (o.perCopy ?? 10));
  return Math.max(0, needed - o.copies);
}
