import type { AssociationOffice, Currency, FeePaymentMethod, FeeRules, FeeStudentGroup, StatementEntry } from '@anu/shared';
import { api } from '@/lib/axios';

export interface BillLine { name: string; amount: number }
export interface FeePaymentRow { id: string; amount: number; method: FeePaymentMethod; reference: string; receiptNumber: string; paidOn: string; createdAt: string; reversedAt: string | null; reversalReason: string | null; originalAmount?: number | null; originalCurrency?: Currency | null; exchangeRate?: number | null }
export interface ExchangeRate { id: string; cedisPerDollar: number; effectiveFrom: string; note: string | null; createdAt: string }
export interface BillFigures { due: number; balance: number; percentPaid: number; overpaid: number }
export interface Bill extends BillFigures {
  id: string;
  semesterId: string;
  lines: BillLine[];
  currency: Currency;
  charged: number;
  issuedAt: string;
  semester: { id: string; number: number; academicYear: { label: string } };
  student: { id: string; firstName: string; lastName: string; indexNumber: string | null; email: string | null; phone: string | null; studentProfile: { currentLevel: number; programme: { name: string } } | null };
  adjustments: Array<{ id: string; amount: number; reason: string; createdAt: string }>;
  payments: FeePaymentRow[];
  clearance: { cleared: boolean; source: 'MANUAL' | 'FEES'; note?: string | null } | null;
  clearancePercent?: number;
  cedisPerDollar?: number | null;
}
export interface MyBill extends Omit<Bill, 'student' | 'clearance'> { semesterLabel: string; cleared: boolean; statement: StatementEntry[] }
export interface Schedule { id: string; name: string; programmeId: string | null; level: number | null; studentGroup: FeeStudentGroup; currency: Currency; programme: { name: string } | null; lines: Array<{ id: string; feeItemId: string | null; name: string; amount: number }>; _count: { bills: number } }
export interface FeeItem { id: string; name: string; description: string | null; isActive: boolean; _count: { lines: number } }
export interface FeeReceipt { originalAmount?: number | null; originalCurrency?: Currency | null; exchangeRate?: number | null; id: string; amount: number; method: FeePaymentMethod; reference: string; receiptNumber: string; paidOn: string; createdAt: string; reversedAt: string | null; reversalReason: string | null; currency: Currency; semester: string; student: { name: string; indexNumber: string | null; programme: string | null; level: number | null }; balanceAfter: number; balanceNow: number }
export interface FeeOptions { semesters: Array<{ id: string; label: string; isCurrent: boolean }>; programmes: Array<{ id: string; name: string }> }

export interface AdminAssociation {
  id: string; code: string; name: string; description: string | null; isActive: boolean;
  payoutNetwork: string | null; payoutNumber: string | null; payoutName: string | null;
  departments: Array<{ id: string; name: string }>;
  officers: Array<{ id: string; office: AssociationOffice; startsOn: string; endsOn: string; current: boolean; student: { id: string; firstName: string; lastName: string; indexNumber: string | null; phone: string | null } }>;
  members: number;
  levies: Array<{ id: string; title: string; amount: number; isOpen: boolean; paidCount: number; online: number; cash: number }>;
}
export interface Receipt { id: string; amount: number; method: 'ONLINE' | 'CASH'; receiptNumber: string; createdAt: string; voidedAt: string | null; voidReason: string | null; levy: { title: string }; student: { firstName: string; lastName: string; indexNumber: string | null } }
export interface Office {
  office: AssociationOffice; endsOn: string;
  association: { id: string; code: string; name: string };
  semester: { id: string; label: string } | null;
  members: number;
  levies: Array<{ id: string; title: string; amount: number; dueOn: string; isOpen: boolean; paidCount: number; online: number; cash: number }>;
}
export interface LevyMembers {
  levy: { id: string; title: string; amount: number; dueOn: string; isOpen: boolean; association: { code: string; name: string } };
  members: Array<{ id: string; firstName: string; lastName: string; indexNumber: string | null; level: number | null; payment: { receiptNumber: string; method: 'ONLINE' | 'CASH'; createdAt: string } | null }>;
}
export interface MyDues {
  associations: Array<{ id: string; code: string; name: string }>;
  provider: string;
  levies: Array<{ id: string; title: string; amount: number; dueOn: string; isOpen: boolean; semester: string; association: { code: string; name: string }; payment: { id: string; amount: number; method: 'ONLINE' | 'CASH'; receiptNumber: string; createdAt: string } | null }>;
  cancelled: Array<{ id: string; amount: number; receiptNumber: string; voidReason: string | null }>;
}
export interface DuesSettlement { id: string; code: string; name: string; payoutNetwork: string | null; payoutNumber: string | null; payoutName: string | null; online: number; cash: number; paidOut: number; owed: number }

export const feesApi = {
  mine: () => api.get<{ rules: FeeRules; provider: string; cedisPerDollar: number | null; bills: MyBill[] }>('/me/fees').then((r) => r.data),
  rates: () => api.get<ExchangeRate[]>('/fees/rates').then((r) => r.data),
  addRate: (dto: { cedisPerDollar: number; effectiveFrom: string; note?: string }) => api.post('/fees/rates', dto),
  deleteRate: (id: string) => api.delete(`/fees/rates/${id}`),
  pay: (billId: string, amount: number) => api.post<{ paymentUrl: string }>('/me/fees/pay', { billId, amount }).then((r) => r.data),

  options: () => api.get<FeeOptions>('/fees/options').then((r) => r.data),
  rules: () => api.get<FeeRules>('/fees/rules').then((r) => r.data),
  saveRules: (dto: Pick<FeeRules, 'minOnlinePayment' | 'minOnlinePaymentUsd'>) => api.put<FeeRules>('/fees/rules', dto).then((r) => r.data),
  items: () => api.get<FeeItem[]>('/fees/items').then((r) => r.data),
  saveItem: (dto: { name: string; description?: string; isActive?: boolean }, id?: string) => (id ? api.put(`/fees/items/${id}`, dto) : api.post('/fees/items', dto)),
  clearanceRule: () => api.get<{ clearancePercent: number }>('/fees/clearance-rule').then((r) => r.data),
  saveClearanceRule: (clearancePercent: number) => api.put<{ clearancePercent: number; rechecked: number }>('/fees/clearance-rule', { clearancePercent }).then((r) => r.data),
  myReceipt: (id: string) => api.get<FeeReceipt>(`/me/fees/receipts/${id}`).then((r) => r.data),
  adminReceipt: (id: string) => api.get<FeeReceipt>(`/fees/payments/${id}/receipt`).then((r) => r.data),
  schedules: (semesterId: string) => api.get<Schedule[]>('/fees/schedules', { params: { semesterId } }).then((r) => r.data),
  saveSchedule: (dto: { semesterId: string; name: string; programmeId: string | null; level: number | null; studentGroup: FeeStudentGroup; currency: Currency; lines: Array<{ feeItemId: string; amount: number }> }, id?: string) => (id ? api.put(`/fees/schedules/${id}`, dto) : api.post('/fees/schedules', dto)),
  deleteSchedule: (id: string) => api.delete(`/fees/schedules/${id}`),
  copySchedules: (fromSemesterId: string, toSemesterId: string) => api.post<{ copied: number; skipped: number }>('/fees/schedules/copy', { fromSemesterId, toSemesterId }).then((r) => r.data),
  issue: (semesterId: string) => api.post<{ issued: number; alreadyBilled: number; noSchedule: number }>('/fees/bills/issue', { semesterId }).then((r) => r.data),
  bills: (p: { semesterId?: string; search?: string; status?: string; page: number }) =>
    api.get<{ items: Bill[]; total: number; page: number; pageSize: number; summary: { bills: number; cleared: number; byCurrency: Array<{ currency: Currency; bills: number; due: number; collected: number }> } | null; clearancePercent: number; semesterId?: string }>('/fees/bills', { params: { ...p, pageSize: 25 } }).then((r) => r.data),
  bill: (id: string) => api.get<Bill>(`/fees/bills/${id}`).then((r) => r.data),
  recordPayment: (id: string, dto: { amount: number; method: 'BANK' | 'MOBILE_MONEY' | 'CHEQUE'; reference: string; paidOn: string; paidCurrency?: Currency }) => api.post<Bill>(`/fees/bills/${id}/payments`, dto).then((r) => r.data),
  adjust: (id: string, dto: { amount: number; reason: string }) => api.post<Bill>(`/fees/bills/${id}/adjustments`, dto).then((r) => r.data),
  reverse: (paymentId: string, reason: string) => api.post<Bill>(`/fees/payments/${paymentId}/reverse`, { reason }).then((r) => r.data),
  duesSettlements: () => api.get<DuesSettlement[]>('/fees/dues-settlements').then((r) => r.data),
  duesPayout: (dto: { associationId: string; amount: number; reference?: string }) => api.post('/fees/dues-payouts', dto),

  associations: () => api.get<AdminAssociation[]>('/associations').then((r) => r.data),
  departments: () => api.get<Array<{ id: string; name: string }>>('/associations/departments').then((r) => r.data),
  saveAssociation: (dto: { code: string; name: string; description?: string; departmentIds: string[]; payoutNetwork?: string; payoutNumber?: string; payoutName?: string; isActive?: boolean }, id?: string) => (id ? api.put(`/associations/${id}`, dto) : api.post('/associations', dto)),
  appoint: (id: string, dto: { indexNumber: string; office: AssociationOffice; startsOn: string; endsOn: string }) => api.post(`/associations/${id}/officers`, dto),
  endTerm: (officerId: string, reason: string) => api.post(`/associations/officers/${officerId}/end`, { reason }),
  receipts: (id: string) => api.get<Receipt[]>(`/associations/${id}/receipts`).then((r) => r.data),
  voidReceipt: (id: string, reason: string) => api.post(`/associations/receipts/${id}/void`, { reason }),

  offices: () => api.get<Office[]>('/association').then((r) => r.data),
  createLevy: (associationId: string, dto: { title: string; amount: number; dueOn: string }) => api.post(`/association/${associationId}/levies`, dto),
  setLevyOpen: (levyId: string, isOpen: boolean) => api.post(`/association/levies/${levyId}/open`, { isOpen }),
  levyMembers: (levyId: string) => api.get<LevyMembers>(`/association/levies/${levyId}`).then((r) => r.data),
  recordCash: (levyId: string, indexNumber: string) => api.post<{ receiptNumber: string; amount: number; student: string }>(`/association/levies/${levyId}/cash`, { indexNumber }).then((r) => r.data),

  myDues: () => api.get<MyDues>('/me/dues').then((r) => r.data),
  payDues: (levyId: string) => api.post<{ paymentUrl: string }>(`/me/dues/levies/${levyId}/pay`).then((r) => r.data),
};

export const semesterText = (s: { number: number; academicYear: { label: string } }) => `${s.academicYear.label}, Semester ${s.number}`;
