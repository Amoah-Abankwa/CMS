import { belowMinimum, checkInStatus, summariseAttendance } from '@anu/shared';
import { codeAt, codeMatches, CODE_STEP_SECONDS, currentStep } from './check-in-code';

describe('attendance rules', () => {
  it('counts late as attended and leaves excused classes out', () => {
    expect(summariseAttendance(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'PRESENT'])).toMatchObject({ percent: 75, counted: 4, excused: 1 });
    expect(summariseAttendance(['EXCUSED']).percent).toBeNull();
  });

  it('treats exactly the minimum as enough', () => {
    expect(belowMinimum(75, 75)).toBe(false);
    expect(belowMinimum(74.9, 75)).toBe(true);
  });

  it('marks self check-in late after the grace period', () => {
    const start = new Date('2026-09-28T08:00:00Z');
    expect(checkInStatus(start, new Date('2026-09-28T08:15:00Z'), 15)).toBe('PRESENT');
    expect(checkInStatus(start, new Date('2026-09-28T08:16:00Z'), 15)).toBe('LATE');
  });
});

describe('check-in codes', () => {
  const secret = 'test-secret';

  it('are six characters without confusable letters', () => {
    const code = codeAt(secret, 123);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('accept the current and previous code only', () => {
    const now = Date.UTC(2026, 8, 28, 8, 0, 10);
    const step = currentStep(now);
    expect(codeMatches(secret, codeAt(secret, step), now)).toBe(true);
    expect(codeMatches(secret, codeAt(secret, step - 1), now)).toBe(true);
    expect(codeMatches(secret, codeAt(secret, step - 2), now)).toBe(false);
    expect(codeMatches('other-secret', codeAt(secret, step), now)).toBe(false);
  });

  it('change every step', () => {
    expect(codeAt(secret, 1)).not.toBe(codeAt(secret, 2));
    expect(CODE_STEP_SECONDS).toBe(30);
  });
});
