import { borrowBlocks, daysOverdue, DEFAULT_LIBRARY_POLICY as P, dueDate, overdueFine, renewBlock, validateLibraryPolicy } from '@anu/shared';

const d = (s: string) => new Date(s);
const due = d('2026-10-19T23:59:59Z');

describe('library rules', () => {
  it('sets the due date at the end of the day and skips Sundays', () => {
    expect(dueDate(d('2026-10-05T10:00:00Z'), 14, P.closedDays).toISOString()).toBe('2026-10-19T23:59:59.000Z');
    expect(dueDate(d('2026-10-05T10:00:00Z'), 13, P.closedDays).toISOString()).toBe('2026-10-19T23:59:59.000Z');
  });

  it('counts whole days late', () => {
    expect(daysOverdue(due, d('2026-10-19T20:00:00Z'))).toBe(0);
    expect(daysOverdue(due, d('2026-10-20T08:00:00Z'))).toBe(1);
  });

  it('fines GH₵ 1.00 a day up to GH₵ 50.00, after any grace days', () => {
    expect(overdueFine(due, d('2026-10-24T08:00:00Z'), P)).toBe(500);
    expect(overdueFine(due, d('2027-02-01T08:00:00Z'), P)).toBe(5000);
    expect(overdueFine(due, d('2026-10-22T08:00:00Z'), { ...P, graceDays: 2 })).toBe(300);
    expect(overdueFine(due, d('2026-11-30T08:00:00Z'), { ...P, finePerDay: 0 })).toBe(0);
  });

  it('stops borrowing at the limit, with overdue books, or with fines owed', () => {
    expect(borrowBlocks({ activeLoans: 3, overdueLoans: 0, finesOwed: 1999 }, P.student, P)).toEqual([]);
    expect(borrowBlocks({ activeLoans: 4, overdueLoans: 1, finesOwed: 2000 }, P.student, P)).toEqual(['LIMIT_REACHED', 'HAS_OVERDUE', 'FINES_OWED']);
    expect(borrowBlocks({ activeLoans: 4, overdueLoans: 0, finesOwed: 0 }, P.staff, P)).toEqual([]);
  });

  it('refuses renewals that are overdue, used up or reserved by someone else', () => {
    const now = d('2026-10-10T10:00:00Z');
    expect(renewBlock({ dueAt: due, renewals: 0 }, false, P.student, now)).toBeNull();
    expect(renewBlock({ dueAt: due, renewals: 0 }, true, P.student, now)).toBe('RESERVED');
    expect(renewBlock({ dueAt: due, renewals: 2 }, false, P.student, now)).toBe('NO_RENEWALS_LEFT');
    expect(renewBlock({ dueAt: due, renewals: 0 }, false, P.student, d('2026-10-21T10:00:00Z'))).toBe('OVERDUE');
  });

  it('accepts the default rules', () => {
    expect(validateLibraryPolicy(P)).toEqual([]);
  });
});
