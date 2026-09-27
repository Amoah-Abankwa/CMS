import { registrationOpen } from './semesters.service';

describe('registrationOpen', () => {
  const opens = new Date('2026-09-01T00:00:00Z');
  const closes = new Date('2026-11-30T23:59:59Z');

  it('is open between the opening and closing times', () => {
    expect(registrationOpen({ registrationOpensAt: opens, registrationClosesAt: closes }, new Date('2026-09-26T10:00:00Z'))).toBe(true);
  });

  it('is closed before it opens and after it closes', () => {
    expect(registrationOpen({ registrationOpensAt: opens, registrationClosesAt: closes }, new Date('2026-08-31T23:00:00Z'))).toBe(false);
    expect(registrationOpen({ registrationOpensAt: opens, registrationClosesAt: closes }, new Date('2026-12-01T00:00:00Z'))).toBe(false);
  });

  it('is closed when no window is set', () => {
    expect(registrationOpen({ registrationOpensAt: null, registrationClosesAt: null })).toBe(false);
  });
});
