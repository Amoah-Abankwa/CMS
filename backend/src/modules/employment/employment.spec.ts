import { canDecide, canTransition, checkEligibility, DEFAULT_EMPLOYMENT_RULES as R, deliveryArea, validateEmploymentRules } from '@anu/shared';

const ok = { cgpa: 3.1, registered: true, holds: [] as Array<'DISCIPLINARY' | 'ADMINISTRATIVE'> };

describe('work eligibility', () => {
  it('applies the minimum CGPA, including a job asking for more', () => {
    expect(checkEligibility({ ...ok, cgpa: 2.5 }, R).eligible).toBe(true);
    expect(checkEligibility({ ...ok, cgpa: 2.49 }, R).reasons).toEqual(['A CGPA of at least 2.50 is needed. Yours is 2.49.']);
    expect(checkEligibility(ok, R, { jobMinCgpa: 3.2 }).eligible).toBe(false);
    expect(checkEligibility({ ...ok, cgpa: 2.6 }, R, { jobMinCgpa: 2 }).requiredCgpa).toBe(2.5);
  });

  it('lets students without results apply only when allowed', () => {
    expect(checkEligibility({ ...ok, cgpa: null }, R).eligible).toBe(true);
    expect(checkEligibility({ ...ok, cgpa: null }, { ...R, allowNoResults: false }).eligible).toBe(false);
  });

  it('needs registration and no disciplinary hold', () => {
    expect(checkEligibility({ ...ok, registered: false }, R).eligible).toBe(false);
    expect(checkEligibility({ ...ok, holds: ['DISCIPLINARY'] }, R).eligible).toBe(false);
    expect(checkEligibility({ ...ok, holds: ['ADMINISTRATIVE'] }, R).eligible).toBe(true);
  });

  it('limits jobs held at once, but not dispatching', () => {
    expect(checkEligibility({ ...ok, currentJobs: 1 }, R, { forJob: true }).eligible).toBe(false);
    expect(checkEligibility({ ...ok, currentJobs: 1 }, R).eligible).toBe(true);
  });

  it('checks the rules themselves', () => {
    expect(validateEmploymentRules(R)).toEqual([]);
    expect(validateEmploymentRules({ ...R, minCgpa: 5, dispatchFee: 0 })).toHaveLength(2);
  });
});

describe('applications', () => {
  it('only allows sensible decisions', () => {
    expect(canDecide('SUBMITTED', 'HIRED')).toBe(true);
    expect(canDecide('REJECTED', 'HIRED')).toBe(false);
    expect(canDecide('HIRED', 'ENDED')).toBe(true);
    expect(canDecide('HIRED', 'REJECTED')).toBe(false);
  });
});

describe('dispatcher deliveries', () => {
  it('lets the dispatcher pick up and complete, but only on dispatched orders', () => {
    expect(canTransition('ACCEPTED', 'READY', 'VENDOR', 'DELIVERY', true)).toBe(true);
    expect(canTransition('READY', 'OUT_FOR_DELIVERY', 'DISPATCHER', 'DELIVERY', true)).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'COMPLETED', 'DISPATCHER', 'DELIVERY', true)).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'DISPATCHER', 'DELIVERY', true)).toBe(false);
    expect(canTransition('OUT_FOR_DELIVERY', 'COMPLETED', 'DISPATCHER', 'DELIVERY', false)).toBe(false);
    expect(canTransition('ACCEPTED', 'OUT_FOR_DELIVERY', 'VENDOR', 'DELIVERY')).toBe(true);
  });

  it('shows only the hall until a delivery is taken', () => {
    expect(deliveryArea('Faith Hall, room F12')).toBe('Faith Hall');
    expect(deliveryArea(null)).toBe('Campus');
  });
});

import { hoursProblems, timesheetAmount, weekOf } from '@anu/shared';

describe('timesheets', () => {
  it('works out pay for hourly, per-task and monthly jobs', () => {
    expect(timesheetAmount('HOUR', 1200, [{ quantity: 3.5 }, { quantity: 4 }])).toBe(9000);
    expect(timesheetAmount('TASK', 5000, [{ quantity: 2 }])).toBe(10000);
    expect(timesheetAmount('MONTH', 30000, [])).toBe(30000);
  });
  it('groups days into weeks starting on Monday', () => {
    expect(weekOf('2026-09-27')).toBe('2026-09-21');
    expect(weekOf('2026-09-28')).toBe('2026-09-28');
  });
  it("keeps to the job's weekly hours and the 20-hour limit across jobs", () => {
    const week = [{ date: '2026-09-28', quantity: 4 }, { date: '2026-09-29', quantity: 4 }];
    expect(hoursProblems(week, 10)).toEqual([]);
    expect(hoursProblems(week, 6)[0]).toMatch("more than this job's 6 hours");
    expect(hoursProblems(week, 10, { '2026-09-28': 14 })[0]).toMatch('20-hour weekly limit');
    expect(hoursProblems([{ date: '2026-09-28', quantity: 2.3 }], 10)[0]).toMatch('quarter hours');
  });
});
