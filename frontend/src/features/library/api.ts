import type { LibraryPolicy, LoanRules } from '@anu/shared';
import { api } from '@/lib/axios';

export interface TitleRow {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  edition: string | null;
  callNumber: string | null;
  subjects: string[];
  copies: number;
  lendable: number;
  available: number;
  referenceOnly: number;
  waiting: number;
}

export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'ON_HOLD' | 'LOST' | 'DAMAGED' | 'WITHDRAWN';

export interface TitleDetail extends Omit<TitleRow, 'copies' | 'lendable' | 'available' | 'referenceOnly' | 'waiting'> {
  description: string | null;
  copies: Array<{ id: string; barcode: string; shelf: string | null; isReference: boolean; status: CopyStatus; notes: string | null; loans: Array<{ dueAt: string; borrower: Person }> }>;
  reservations: Array<{ id: string; status: 'WAITING' | 'READY'; createdAt: string; expiresAt: string | null; borrower: Person }>;
}

export interface Person {
  firstName: string;
  lastName: string;
  indexNumber: string | null;
  email: string | null;
}

export interface TitleInput {
  title: string;
  subtitle?: string;
  authors: string[];
  isbn?: string;
  publisher?: string;
  year?: number;
  edition?: string;
  callNumber?: string;
  subjects?: string[];
  description?: string;
}

export interface BorrowerRow {
  id: string;
  type: 'STUDENT' | 'STAFF';
  status: string;
  firstName: string;
  lastName: string;
  indexNumber: string | null;
  email: string | null;
  phone: string | null;
  staffProfile: { staffNumber: string } | null;
  studentProfile: { programme: { name: string }; currentLevel: number } | null;
}

export interface BorrowerSummary {
  borrower: BorrowerRow & { kind: 'STUDENT' | 'STAFF' };
  rules: LoanRules;
  policy: { finePerDay: number; blockAtFines: number; holdDays: number; maxReservations: number };
  loans: Array<{
    id: string;
    issuedAt: string;
    dueAt: string;
    renewals: number;
    overdueDays: number;
    fineSoFar: number;
    canRenew: boolean;
    renewBlock: string | null;
    copy: { barcode: string; title: { id: string; title: string; authors: string[] } };
  }>;
  reservations: Array<{ id: string; status: 'WAITING' | 'READY'; createdAt: string; expiresAt: string | null; position: number; title: { id: string; title: string }; copy: { barcode: string } | null }>;
  fines: Array<{ id: string; reason: 'OVERDUE' | 'LOST' | 'DAMAGED'; amount: number; paid: number; waived: number; outstanding: number; note: string | null; createdAt: string }>;
  owed: number;
  blocks: string[];
}

export interface FineRow {
  id: string;
  reason: 'OVERDUE' | 'LOST' | 'DAMAGED';
  amount: number;
  paid: number;
  waived: number;
  outstanding: number;
  note: string | null;
  createdAt: string;
  settledAt: string | null;
  borrower: Person & { id: string };
  payments: Array<{ amount: number; method: 'CASH' | 'MOBILE_MONEY' | 'WAIVER'; receiptNumber: string | null; note: string | null; createdAt: string }>;
}

export interface OverdueRow {
  id: string;
  dueAt: string;
  days: number;
  fineSoFar: number;
  overdueNoticeCount: number;
  copy: { barcode: string; title: { title: string } };
  borrower: Person & { id: string; type: string; phone: string | null };
}

export interface HoldRow {
  id: string;
  readyAt: string;
  expiresAt: string;
  copy: { barcode: string } | null;
  title: { title: string };
  borrower: Person;
}

export const libraryApi = {
  policy: () => api.get<LibraryPolicy>('/library/policy').then((r) => r.data),
  setPolicy: (p: LibraryPolicy) => api.put<LibraryPolicy>('/library/policy', p).then((r) => r.data),
  search: (params: { search?: string; availableOnly?: boolean; page: number; pageSize?: number }) =>
    api
      .get<{ total: number; page: number; pageSize: number; items: TitleRow[] }>('/library/catalogue', { params: { ...params, availableOnly: params.availableOnly ? 'true' : undefined } })
      .then((r) => r.data),
  title: (id: string) => api.get<TitleDetail>(`/library/catalogue/${id}`).then((r) => r.data),
  saveTitle: (dto: TitleInput, id?: string) => (id ? api.patch(`/library/titles/${id}`, dto) : api.post<{ id: string }>('/library/titles', dto)).then((r) => r.data),
  addCopies: (titleId: string, barcodes: string[], shelf?: string, isReference?: boolean) =>
    api.post<{ added: number }>(`/library/titles/${titleId}/copies`, { barcodes, shelf, isReference }).then((r) => r.data),
  updateCopy: (id: string, dto: { shelf?: string; isReference?: boolean; status?: 'AVAILABLE' | 'DAMAGED' | 'WITHDRAWN'; notes?: string }) => api.patch(`/library/copies/${id}`, dto),

  lookup: (q: string) => api.get<BorrowerRow[]>('/library/desk/borrowers', { params: { q } }).then((r) => r.data),
  borrower: (id: string) => api.get<BorrowerSummary>(`/library/desk/borrowers/${id}`).then((r) => r.data),
  issue: (borrowerId: string, barcode: string) => api.post<{ title: string; dueAt: string }>('/library/desk/issue', { borrowerId, barcode }).then((r) => r.data),
  returnCopy: (barcode: string) =>
    api
      .post<{ title: string; borrower: Person; daysLate: number; fine: number; foundAfterLost: boolean; heldFor: string | null }>('/library/desk/return', { barcode })
      .then((r) => r.data),
  deskRenew: (loanId: string) => api.post<{ dueAt: string; renewalsLeft: number }>(`/library/desk/loans/${loanId}/renew`).then((r) => r.data),
  lost: (loanId: string) => api.post<{ fee: number }>(`/library/desk/loans/${loanId}/lost`).then((r) => r.data),
  overdue: () => api.get<OverdueRow[]>('/library/overdue').then((r) => r.data),
  holds: () => api.get<HoldRow[]>('/library/holds').then((r) => r.data),
  stats: () => api.get<{ titles: number; copies: number; onLoan: number; overdue: number; waiting: number; ready: number; finesOwed: number }>('/library/stats').then((r) => r.data),
  fines: (params: { status?: string; search?: string; page: number; pageSize?: number }) =>
    api.get<{ total: number; page: number; pageSize: number; items: FineRow[] }>('/library/fines', { params }).then((r) => r.data),
  pay: (id: string, amount: number, method: 'CASH' | 'MOBILE_MONEY', receiptNumber?: string) => api.post<{ remaining: number }>(`/library/fines/${id}/pay`, { amount, method, receiptNumber }).then((r) => r.data),
  waive: (id: string, reason: string, amount?: number) => api.post<{ remaining: number }>(`/library/fines/${id}/waive`, { reason, amount }).then((r) => r.data),

  mine: () => api.get<BorrowerSummary>('/me/library').then((r) => r.data),
  renew: (loanId: string) => api.post<{ dueAt: string; renewalsLeft: number }>(`/me/library/loans/${loanId}/renew`).then((r) => r.data),
  reserve: (titleId: string) => api.post<{ position: number }>('/me/library/reservations', { titleId }).then((r) => r.data),
  cancelReservation: (id: string) => api.post(`/me/library/reservations/${id}/cancel`),
};

export const COPY_STATUS: Record<CopyStatus, { label: string; tone: 'success' | 'primary' | 'warning' | 'danger' | 'neutral' }> = {
  AVAILABLE: { label: 'On the shelf', tone: 'success' },
  ON_LOAN: { label: 'On loan', tone: 'primary' },
  ON_HOLD: { label: 'Kept for a reservation', tone: 'warning' },
  LOST: { label: 'Lost', tone: 'danger' },
  DAMAGED: { label: 'Damaged', tone: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};
export const FINE_REASON = { OVERDUE: 'Late return', LOST: 'Lost book', DAMAGED: 'Damaged book' } as const;
export const PAYMENT_METHOD = { CASH: 'Cash', MOBILE_MONEY: 'Mobile money', WAIVER: 'Waived' } as const;
export const dueLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const byLine = (authors: string[]) => (authors.length > 2 ? `${authors[0]} and others` : authors.join(' and '));
