import { DEFAULT_DEVOTION_POLICY as P, devotionScore, devotionStatusAt, devotionTimes, serviceDates, validateDevotionPolicy, type DevotionStatus } from '@anu/shared';

const times = devotionTimes('2026-09-28', P);
const at = (hms: string) => new Date(`2026-09-28T${hms}Z`);
const statusAt = (hms: string) => {
  const r = devotionStatusAt(times, at(hms));
  return 'status' in r ? r.status : r.error;
};
const many = (early: number, late: number, absent: number, excused = 0) =>
  [...Array(early).fill('EARLY'), ...Array(late).fill('LATE'), ...Array(absent).fill('ABSENT'), ...Array(excused).fill('EXCUSED')] as DevotionStatus[];

describe('morning devotion', () => {
  it('uses 7:30 to 7:50 as early and 7:50 to 8:00 as late', () => {
    expect(statusAt('06:59:59')).toBe('NOT_OPEN');
    expect(statusAt('07:10:00')).toBe('EARLY');
    expect(statusAt('07:49:59')).toBe('EARLY');
    expect(statusAt('07:50:00')).toBe('LATE');
    expect(statusAt('07:59:59')).toBe('LATE');
    expect(statusAt('08:00:00')).toBe('ENDED');
  });

  it('totals 5.00 for a student early every time', () => {
    expect(devotionScore(many(40, 0, 0), P).score).toBe(5);
  });

  it('gives late half the marks of early by default', () => {
    expect(devotionScore(many(30, 8, 2, 5), P).score).toBe(4.25);
    expect(devotionScore(many(0, 40, 0), P).score).toBe(2.5);
  });

  it('leaves excused services out', () => {
    expect(devotionScore(many(10, 0, 0, 30), P).score).toBe(5);
  });

  it('refuses rules where late earns as much as early', () => {
    expect(validateDevotionPolicy({ ...P, lateCredit: 1 })).not.toEqual([]);
  });

  it('schedules Monday, Tuesday, Thursday and Friday', () => {
    expect(serviceDates(new Date('2026-09-07'), new Date('2026-09-13'), P.days)).toEqual(['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11']);
  });
});
