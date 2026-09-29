import { billBalance, feeClearanceChange, pickSchedule, receiptNumber, scheduleClash, termActive, validAssociationCode, validateFeeRules, DEFAULT_FEE_RULES } from '@anu/shared';

describe('fee schedules', () => {
  const all = { id: 'all', programmeId: null, level: null };
  const l100 = { id: 'l100', programmeId: null, level: 100 };
  const cs = { id: 'cs', programmeId: 'CS', level: null };
  const cs100 = { id: 'cs100', programmeId: 'CS', level: 100 };
  it('uses the most specific schedule that fits', () => {
    expect(pickSchedule([all, l100, cs, cs100], { programmeId: 'CS', level: 100 })!.id).toBe('cs100');
    expect(pickSchedule([all, l100, cs], { programmeId: 'CS', level: 200 })!.id).toBe('cs');
    expect(pickSchedule([all, l100], { programmeId: 'ACC', level: 100 })!.id).toBe('l100');
    expect(pickSchedule([all], { programmeId: 'ACC', level: 300 })!.id).toBe('all');
    expect(pickSchedule([cs100], { programmeId: 'ACC', level: 100 })).toBeNull();
  });
  it('refuses two schedules for exactly the same students', () => {
    expect(scheduleClash(cs, { id: 'x', programmeId: 'CS', level: null })).toBe(true);
    expect(scheduleClash(cs, cs100)).toBe(false);
  });
});

describe('bills and clearance', () => {
  it('works out balance and percentage paid, including waivers', () => {
    expect(billBalance({ charged: 400000, adjustments: -100000, paid: 150000 })).toEqual({ due: 300000, balance: 150000, percentPaid: 50, overpaid: 0 });
    expect(billBalance({ charged: 300000, adjustments: 0, paid: 209999 }).percentPaid).toBe(69.99);
    expect(billBalance({ charged: 0, adjustments: 0, paid: 0 }).percentPaid).toBe(100);
    expect(billBalance({ charged: 1000, adjustments: 0, paid: 1500 }).overpaid).toBe(500);
  });
  it('clears automatically at the threshold and withdraws only its own clearance', () => {
    expect(feeClearanceChange(null, 70, 70)).toEqual({ cleared: true });
    expect(feeClearanceChange(null, 69.99, 70)).toBeNull();
    expect(feeClearanceChange({ cleared: true, source: 'FEES' }, 60, 70)).toEqual({ cleared: false });
    expect(feeClearanceChange({ cleared: true, source: 'FEES' }, 80, 70)).toBeNull();
    expect(feeClearanceChange({ cleared: false, source: 'MANUAL' }, 100, 70)).toBeNull();
    expect(feeClearanceChange({ cleared: true, source: 'MANUAL' }, 0, 70)).toBeNull();
  });
  it('checks the fee rules', () => {
    expect(validateFeeRules(DEFAULT_FEE_RULES)).toEqual([]);
    expect(validateFeeRules({ clearancePercent: 0, minOnlinePayment: 10, minOnlinePaymentUsd: 1000 })).toHaveLength(2);
  });
});

describe('departmental dues', () => {
  it('numbers receipts per association', () => {
    expect(receiptNumber('ehassa', 123)).toBe('EHASSA-000123');
  });
  it('accepts short association codes only', () => {
    expect(validAssociationCode('EHASSA')).toBe(true);
    expect(validAssociationCode('BACA')).toBe(true);
    expect(validAssociationCode('ba ca')).toBe(false);
    expect(validAssociationCode('A')).toBe(false);
  });
  it('knows when an officer term is current, through the whole last day', () => {
    const term = { startsOn: new Date('2026-09-01T00:00:00Z'), endsOn: new Date('2027-08-31T00:00:00Z'), endedAt: null };
    expect(termActive(term, new Date('2027-08-31T22:00:00Z'))).toBe(true);
    expect(termActive(term, new Date('2027-09-01T00:00:01Z'))).toBe(false);
    expect(termActive(term, new Date('2026-08-31T12:00:00Z'))).toBe(false);
    expect(termActive({ ...term, endedAt: new Date('2027-01-10T00:00:00Z') }, new Date('2027-02-01T00:00:00Z'))).toBe(false);
  });
});

import { feeStatement, formatMoney, studentGroupOf } from '@anu/shared';

describe('international students and statements', () => {
  it('bills international students from their own schedule', () => {
    const local = { id: 'local', programmeId: null, level: null, studentGroup: 'GHANAIAN' as const };
    const intl = { id: 'intl', programmeId: null, level: null, studentGroup: 'INTERNATIONAL' as const };
    const all = { id: 'all', programmeId: null, level: null };
    expect(pickSchedule([all, local, intl], { programmeId: 'CS', level: 100, group: 'INTERNATIONAL' })!.id).toBe('intl');
    expect(pickSchedule([all, local, intl], { programmeId: 'CS', level: 100, group: 'GHANAIAN' })!.id).toBe('local');
    expect(pickSchedule([local], { programmeId: 'CS', level: 100, group: 'INTERNATIONAL' })).toBeNull();
    expect(scheduleClash(local, { ...intl, id: 'x' })).toBe(false);
  });
  it('treats a missing nationality as Ghanaian', () => {
    expect(studentGroupOf(null)).toBe('GHANAIAN');
    expect(studentGroupOf('Ghanaian')).toBe('GHANAIAN');
    expect(studentGroupOf('Nigerian')).toBe('INTERNATIONAL');
  });
  it('shows cedis and dollars', () => {
    expect(formatMoney(185000, 'GHS')).toBe('GH₵ 1,850.00');
    expect(formatMoney(120000, 'USD')).toBe('US$ 1,200.00');
  });
  it('builds a statement with debits, credits and a running balance', () => {
    const s = feeStatement({
      issuedAt: '2026-08-20T09:00:00Z',
      lines: [{ name: 'Tuition', amount: 300000 }, { name: 'SRC dues', amount: 10000 }],
      adjustments: [{ amount: -50000, reason: 'Scholarship', createdAt: '2026-08-21T09:00:00Z' }],
      payments: [
        { amount: 100000, method: 'BANK', receiptNumber: 'R1', paidOn: '2026-08-25', reversedAt: null, reversalReason: null },
        { amount: 20000, method: 'CHEQUE', receiptNumber: 'R2', paidOn: '2026-08-26', reversedAt: '2026-08-30T00:00:00Z', reversalReason: 'Cheque bounced' },
      ],
    });
    expect(s.map((e) => e.balance)).toEqual([300000, 310000, 260000, 160000, 140000, 160000]);
    expect(s[2]).toMatchObject({ description: 'Scholarship', credit: 50000, debit: 0 });
    expect(s[5]).toMatchObject({ debit: 20000, receipt: 'R2' });
  });
});

import { convertMoney, dispatchFeeSettlement, rateAt } from '@anu/shared';

describe('exchange rates', () => {
  it('converts in both directions to the nearest pesewa or cent', () => {
    expect(convertMoney(10000, 'USD', 'GHS', 15.25)).toBe(152500);
    expect(convertMoney(152500, 'GHS', 'USD', 15.25)).toBe(10000);
    expect(convertMoney(100, 'GHS', 'USD', 15.25)).toBe(7);
    expect(convertMoney(5000, 'GHS', 'GHS', 0)).toBe(5000);
    expect(() => convertMoney(5000, 'USD', 'GHS', 0)).toThrow('No exchange rate');
  });
  it('uses the latest rate that has taken effect', () => {
    const rates = [{ effectiveFrom: '2026-09-01', cedisPerDollar: 15 }, { effectiveFrom: '2026-09-20', cedisPerDollar: 15.5 }, { effectiveFrom: '2026-10-01', cedisPerDollar: 16 }];
    expect(rateAt(rates, new Date('2026-09-27'))!.cedisPerDollar).toBe(15.5);
    expect(rateAt(rates, new Date('2026-08-01'))).toBeNull();
  });
});

describe('who pays the campus dispatcher', () => {
  it('follows how the customer paid', () => {
    expect(dispatchFeeSettlement('INCLUDED', 'ONLINE')).toBe('UNIVERSITY');
    expect(dispatchFeeSettlement('INCLUDED', 'ON_PICKUP')).toBe('VENDOR');
    expect(dispatchFeeSettlement('ON_DELIVERY', 'ONLINE')).toBe('CUSTOMER');
    expect(dispatchFeeSettlement('ON_DELIVERY', 'ON_PICKUP')).toBe('CUSTOMER');
  });
});

import { indexNumbersIn, instalmentPlanProblem, instalmentStatus } from '@anu/shared';

describe('fee instalments', () => {
  const plan = [{ dueDate: '2026-09-30', cumulativePercent: 50 }, { dueDate: '2026-10-31', cumulativePercent: 75 }, { dueDate: '2026-11-30', cumulativePercent: 100 }];
  it('checks the plan', () => {
    expect(instalmentPlanProblem(plan)).toBeNull();
    expect(instalmentPlanProblem([{ dueDate: '2026-09-30', cumulativePercent: 60 }])).toMatch('100%');
    expect(instalmentPlanProblem([{ dueDate: '2026-10-30', cumulativePercent: 50 }, { dueDate: '2026-09-30', cumulativePercent: 100 }])).toMatch('go up');
  });
  it('shows what is due next and which instalments were missed', () => {
    const s = instalmentStatus(200000, 80000, plan, '2026-10-05');
    expect(s.missed.map((m) => m.index)).toEqual([0]);
    expect(s.next).toMatchObject({ index: 1, required: 150000, toPay: 70000 });
    expect(instalmentStatus(200000, 200000, plan, '2026-12-01')).toEqual({ missed: [], next: null });
  });
});

describe('bank statement matching', () => {
  it('finds index numbers in narrations', () => {
    expect(indexNumbersIn('FEES PYMT ANU25400001 AMA MENSAH')).toEqual(['ANU25400001']);
    expect(indexNumbersIn('school fees anugs260004/ tuition')).toEqual(['ANUGS260004']);
    expect(indexNumbersIn('Transfer from 0244123456')).toEqual([]);
  });
});
