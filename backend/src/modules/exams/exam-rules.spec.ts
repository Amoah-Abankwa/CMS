import { decideEligibility, eligibilitySummary, findTimetableIssues, type ScheduledPaper } from '@anu/shared';

const at = (h: number) => new Date(Date.UTC(2026, 11, 7, h));
const paper = (id: string, off: string, s: number, e: number, venue: string | null, cap: number | null, inv: string[] = []): ScheduledPaper => ({
  sessionId: id, offeringId: off, label: off, start: at(s), end: at(e), venueId: venue, venueName: venue, venueCapacity: cap, invigilatorIds: inv,
});
const enrolled = new Map([
  ['CSC101', new Set(['s1', 's2', 's3'])],
  ['GNS101', new Set(['s3', 's4'])],
  ['ACC101', new Set(['s5', 's6'])],
]);

describe('exam timetable rules', () => {
  it('finds students with overlapping papers', () => {
    const issues = findTimetableIssues([paper('a', 'CSC101', 9, 11, 'H1', 10), paper('b', 'GNS101', 10, 12, 'H2', 10)], enrolled);
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'STUDENT_CLASH', students: 1 })]));
  });

  it('allows back-to-back papers', () => {
    expect(findTimetableIssues([paper('a', 'CSC101', 9, 11, 'H1', 10), paper('b', 'GNS101', 11, 13, 'H1', 10)], enrolled)).toEqual([]);
  });

  it('lets papers share a hall only within its seats', () => {
    expect(findTimetableIssues([paper('a', 'CSC101', 9, 11, 'H', 5), paper('c', 'ACC101', 9, 11, 'H', 5)], enrolled)).toEqual([]);
    const over = findTimetableIssues([paper('a', 'CSC101', 9, 11, 'H', 4), paper('c', 'ACC101', 9, 11, 'H', 4)], enrolled);
    expect(over).toEqual([expect.objectContaining({ kind: 'VENUE_OVER_CAPACITY', seatsNeeded: 5, capacity: 4 })]);
  });

  it('finds invigilators in two places at once', () => {
    const issues = findTimetableIssues([paper('a', 'CSC101', 9, 11, 'H1', 50, ['u1']), paper('c', 'ACC101', 10, 12, 'H2', 50, ['u1'])], enrolled);
    expect(issues).toEqual([expect.objectContaining({ kind: 'INVIGILATOR_CLASH' })]);
  });

  it('warns about missing venues and unscheduled papers without blocking', () => {
    const issues = findTimetableIssues([paper('a', 'CSC101', 9, 11, null, null)], enrolled, [
      { offeringId: 'CSC101', label: 'CSC101' },
      { offeringId: 'ACC101', label: 'ACC101' },
    ]);
    expect(issues.map((i) => i.severity)).toEqual(['warning', 'warning']);
  });
});

describe('exam eligibility rules', () => {
  const policy = { requireFinancialClearance: true, requireMinimumAttendance: true };

  it('requires fee clearance when the policy says so', () => {
    expect(decideEligibility('x', { feesCleared: false, holds: [] }, policy)).toEqual({ eligible: false, reasons: ['FEES_NOT_CLEARED'] });
    expect(decideEligibility('x', { feesCleared: false, holds: [] }, { requireFinancialClearance: false, requireMinimumAttendance: false }).eligible).toBe(true);
  });

  it('applies a course hold to that course only, and an all-paper hold to everything', () => {
    const holds = [{ offeringId: 'y', category: 'ACADEMIC_MISCONDUCT' as const }];
    expect(decideEligibility('x', { feesCleared: true, holds }, policy).eligible).toBe(true);
    expect(decideEligibility('y', { feesCleared: true, holds }, policy).reasons).toEqual(['HOLD_ACADEMIC_MISCONDUCT']);
    expect(decideEligibility('z', { feesCleared: true, holds: [{ offeringId: null, category: 'DISCIPLINARY' }] }, policy).eligible).toBe(false);
  });

  it('blocks low attendance only when attendance was recorded and the rule is on', () => {
    const input = { feesCleared: true, holds: [], minimumAttendancePercent: 75 };
    expect(decideEligibility('x', { ...input, attendancePercent: 60 }, policy).reasons).toEqual(['LOW_ATTENDANCE']);
    expect(decideEligibility('x', { ...input, attendancePercent: 75 }, policy).eligible).toBe(true);
    expect(decideEligibility('x', { ...input, attendancePercent: null }, policy).eligible).toBe(true);
    expect(decideEligibility('x', { ...input, attendancePercent: 60 }, { ...policy, requireMinimumAttendance: false }).eligible).toBe(true);
  });

  it('summarises without naming the reason', () => {
    expect(eligibilitySummary(5, 0)).toBe('Eligible for all 5 papers');
    expect(eligibilitySummary(5, 2)).toBe('Not eligible for 2 of 5 papers');
  });
});
