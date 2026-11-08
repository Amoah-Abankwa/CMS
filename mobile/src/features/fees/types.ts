export interface MyBill {
  id: string;
  semesterLabel: string;
  currency: 'GHS' | 'USD';
  charged: number;
  adjustments: number;
  paid: number;
  /** Worked out by the backend (includes late charges); the fallback below is only for older data. */
  balance?: number;
  cleared: boolean;
  instalments?: { next: { dueDate: string; toPay: number } | null } | null;
}
export interface MyFees { bills: MyBill[] }

/** What is still owed on a bill (charges and adjustments, less payments). */
export const balanceOf = (b: MyBill) => Math.max(0, typeof b.balance === 'number' ? b.balance : b.charged + b.adjustments - b.paid);
