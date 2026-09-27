import { canTransition, commission, isOpenAt, orderTotals, validateHours, type OpeningHours } from '@anu/shared';

const hours: OpeningHours = { '1': [['07:00', '14:00'], ['17:00', '21:00']], '0': [] };
const monday = (hm: string) => new Date(`2026-09-28T${hm}:00Z`);

describe('food marketplace rules', () => {
  it('knows when a vendor is open', () => {
    expect(isOpenAt(hours, monday('07:00'))).toBe(true);
    expect(isOpenAt(hours, monday('14:00'))).toBe(false);
    expect(isOpenAt(hours, monday('15:30'))).toBe(false);
    expect(isOpenAt(hours, monday('20:59'))).toBe(true);
    expect(isOpenAt(hours, new Date('2026-09-27T10:00:00Z'))).toBe(false);
    expect(isOpenAt(hours, monday('08:00'), true)).toBe(false);
  });

  it('checks opening hours', () => {
    expect(validateHours(hours)).toEqual([]);
    expect(validateHours({ '1': [['14:00', '07:00']] })).toHaveLength(1);
  });

  it('adds delivery and checks the minimum order', () => {
    const lines = [{ price: 3500, quantity: 2 }, { price: 500, quantity: 1 }];
    expect(orderTotals(lines, 'PICKUP', { deliveryFee: 500, minimumOrder: 2000 })).toEqual({ subtotal: 7500, deliveryFee: 0, total: 7500, belowMinimum: false });
    expect(orderTotals(lines, 'DELIVERY', { deliveryFee: 500, minimumOrder: 2000 }).total).toBe(8000);
    expect(orderTotals([{ price: 1000, quantity: 1 }], 'PICKUP', { deliveryFee: 0, minimumOrder: 2000 }).belowMinimum).toBe(true);
  });

  it('rounds commission to the pesewa', () => {
    expect(commission(7500, 5)).toBe(375);
    expect(commission(333, 5)).toBe(17);
  });

  it('only lets the right person move an order', () => {
    expect(canTransition('PLACED', 'CANCELLED', 'CUSTOMER', 'PICKUP')).toBe(true);
    expect(canTransition('ACCEPTED', 'CANCELLED', 'CUSTOMER', 'PICKUP')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'ACCEPTED', 'VENDOR', 'PICKUP')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'PLACED', 'CUSTOMER', 'PICKUP')).toBe(false);
    expect(canTransition('ACCEPTED', 'READY', 'VENDOR', 'PICKUP')).toBe(true);
    expect(canTransition('ACCEPTED', 'READY', 'VENDOR', 'DELIVERY')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED', 'VENDOR', 'PICKUP')).toBe(false);
  });
});
