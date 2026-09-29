/**
 * Food marketplace rules shared by backend and frontend. Money in pesewas. Ghana is UTC all year.
 */

export type OrderStatus = 'PENDING_PAYMENT' | 'PLACED' | 'ACCEPTED' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export type Fulfilment = 'PICKUP' | 'DELIVERY';
export type OrderActor = 'CUSTOMER' | 'VENDOR' | 'SYSTEM' | 'DISPATCHER';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Waiting for payment',
  PLACED: 'Waiting for the vendor',
  ACCEPTED: 'Being prepared',
  READY: 'Ready to collect',
  OUT_FOR_DELIVERY: 'On the way',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined by the vendor',
};

/** Opening hours: weekday (0 Sunday to 6 Saturday) to a list of [open, close] times. */
export type OpeningHours = Record<string, Array<[string, string]>>;

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function isOpenAt(hours: OpeningHours, at: Date, pausedByVendor = false): boolean {
  if (pausedByVendor) return false;
  const slots = hours[String(at.getUTCDay())] ?? [];
  const now = at.getUTCHours() * 60 + at.getUTCMinutes();
  return slots.some(([open, close]) => minutes(open) <= now && now < minutes(close));
}

export function validateHours(hours: OpeningHours): string[] {
  const problems: string[] = [];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const [day, slots] of Object.entries(hours)) {
    if (!/^[0-6]$/.test(day)) problems.push('Days must be 0 to 6.');
    for (const [o, c] of slots) {
      if (!time.test(o) || !time.test(c)) problems.push('Times must look like 07:30.');
      else if (minutes(o) >= minutes(c)) problems.push('Closing time must be after opening time.');
    }
  }
  return [...new Set(problems)];
}

export interface CartLine {
  price: number;
  quantity: number;
}

export function orderTotals(lines: CartLine[], fulfilment: Fulfilment, vendor: { deliveryFee: number; minimumOrder: number }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const deliveryFee = fulfilment === 'DELIVERY' ? vendor.deliveryFee : 0;
  return { subtotal, deliveryFee, total: subtotal + deliveryFee, belowMinimum: subtotal < vendor.minimumOrder };
}

/** Commission on online sales, rounded to the nearest pesewa. */
export function commission(amount: number, percent: number) {
  return Math.round((amount * percent) / 100);
}

/**
 * Who may move an order from one status to another. Customers can only cancel before the vendor
 * accepts; vendors move orders forward, or cancel with a reason; the system confirms payment and
 * cancels orders left unpaid.
 *
 * Deliveries by a campus dispatcher (viaDispatcher): the vendor marks the order ready, a dispatcher
 * picks it up (on the way) and completes it with the customer's code. If no dispatcher takes it, the
 * vendor can send it out with their own staff and complete it themselves.
 */
export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor, fulfilment: Fulfilment, viaDispatcher = false): boolean {
  const dispatch = viaDispatcher && fulfilment === 'DELIVERY';
  const allowed: Array<[OrderStatus, OrderStatus, OrderActor[]]> = [
    ['PENDING_PAYMENT', 'PLACED', ['SYSTEM']],
    ['PENDING_PAYMENT', 'CANCELLED', ['CUSTOMER', 'SYSTEM']],
    ['PLACED', 'ACCEPTED', ['VENDOR']],
    ['PLACED', 'REJECTED', ['VENDOR']],
    ['PLACED', 'CANCELLED', ['CUSTOMER']],
    ['ACCEPTED', 'CANCELLED', ['VENDOR']],
    ['READY', 'CANCELLED', ['VENDOR']],
    ['OUT_FOR_DELIVERY', 'CANCELLED', ['VENDOR']],
  ];
  if (dispatch) {
    allowed.push(
      ['ACCEPTED', 'READY', ['VENDOR']],
      ['READY', 'OUT_FOR_DELIVERY', ['DISPATCHER', 'VENDOR']],
      ['OUT_FOR_DELIVERY', 'COMPLETED', ['DISPATCHER', 'VENDOR']],
    );
  } else {
    allowed.push(
      ['ACCEPTED', fulfilment === 'PICKUP' ? 'READY' : 'OUT_FOR_DELIVERY', ['VENDOR']],
      ['READY', 'COMPLETED', ['VENDOR']],
      ['OUT_FOR_DELIVERY', 'COMPLETED', ['VENDOR']],
    );
  }
  return allowed.some(([f, t, actors]) => f === from && t === to && actors.includes(actor));
}

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY'];

// ----- Scheduled orders -----

/**
 * Whether an order can be scheduled for a time: at least the preparation time plus 15 minutes ahead,
 * at most two days ahead, and inside the vendor's opening hours. Returns a reason, or null if fine.
 */
export function scheduleProblem(at: Date, now: Date, prepMinutes: number, hours: OpeningHours): string | null {
  const earliest = now.getTime() + (prepMinutes + 15) * 60_000;
  if (at.getTime() < earliest) return `Choose a time at least ${prepMinutes + 15} minutes from now.`;
  if (at.getTime() > now.getTime() + 2 * 86_400_000) return 'You can schedule up to two days ahead.';
  if (!isOpenAt(hours, at)) return 'The vendor is closed at that time.';
  return null;
}

// ----- Meal plans -----

/** A meal on a plan covers one eligible dish: the dearest eligible dish in the basket. */
export function mealCredit(lines: Array<{ menuItemId: string; price: number }>, eligibleItemIds: string[]) {
  const eligible = lines.filter((l) => eligibleItemIds.includes(l.menuItemId));
  if (!eligible.length) return null;
  const best = eligible.reduce((a, b) => (b.price > a.price ? b : a));
  return { menuItemId: best.menuItemId, amount: best.price };
}

// ----- Ratings -----

export function averageStars(stars: number[]) {
  if (!stars.length) return null;
  return Math.round((stars.reduce((t, s) => t + s, 0) / stars.length) * 10) / 10;
}

// ----- Paystack mobile money transfer codes (Ghana) -----

/** Paystack bank codes for mobile money recipients in Ghana, by the network names used on the platform. */
export const MOMO_BANK_CODE: Record<string, string> = { MTN: 'MTN', Telecel: 'VOD', AirtelTigo: 'ATL' };
