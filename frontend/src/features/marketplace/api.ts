import type { OpeningHours, OrderStatus } from '@anu/shared';
import { api } from '@/lib/axios';

export interface VendorPublic {
  id: string;
  name: string;
  description: string | null;
  location: string;
  phone: string;
  openingHours: OpeningHours;
  paused: boolean;
  acceptsOnline: boolean;
  acceptsPayOnPickup: boolean;
  offersPickup: boolean;
  offersDelivery: boolean;
  /** Deliveries go to campus dispatchers and must be paid online. */
  useDispatchers: boolean;
  deliveryFee: number;
  deliveryNote: string | null;
  minimumOrder: number;
  prepMinutes: number;
  openNow: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  tags: string[];
  categoryId: string | null;
  position?: number;
}

export interface VendorMenu extends VendorPublic {
  categories: Array<{ id: string; name: string }>;
  items: MenuItem[];
  defaultAddress: string | null;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  fulfilment: 'PICKUP' | 'DELIVERY';
  viaDispatcher: boolean;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  paymentOption: 'ONLINE' | 'ON_PICKUP';
  subtotal: number;
  deliveryFee: number;
  total: number;
  pickupCode?: string;
  note: string | null;
  paid: boolean;
  placedAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  vendor: { id: string; name: string; location: string; phone: string };
  customer: { id: string; firstName: string; lastName: string; indexNumber: string | null; phone: string | null };
  items: Array<{ name: string; unitPrice: number; quantity: number; lineTotal: number }>;
  payments: Array<{ reference: string; status: string; provider: string; channel: string | null }>;
  delivery: null | {
    id: string;
    status: 'WAITING' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
    fee: number;
    dispatcherId: string | null;
    problemNote: string | null;
    dispatcher: { transport: string; student: { firstName: string; lastName: string; phone: string | null } } | null;
  };
}

export interface MyVendor extends VendorPublic {
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  statusNote: string | null;
  payoutNetwork: string | null;
  payoutNumber: string | null;
  payoutName: string | null;
  categories: Array<{ id: string; name: string; position: number }>;
  items: MenuItem[];
}

export type VendorProfileInput = Pick<MyVendor, 'location' | 'phone' | 'openingHours' | 'acceptsOnline' | 'acceptsPayOnPickup' | 'offersPickup' | 'offersDelivery' | 'useDispatchers' | 'deliveryFee' | 'minimumOrder' | 'prepMinutes'> & {
  description?: string;
  deliveryNote?: string;
  payoutNetwork?: string;
  payoutNumber?: string;
  payoutName?: string;
};

export interface Board {
  vendor: { id: string; name: string; paused: boolean; openNow: boolean; status: string };
  active: Order[];
  done: Order[];
  salesToday: number;
}

export interface AdminVendor {
  id: string;
  name: string;
  location: string;
  phone: string;
  status: MyVendor['status'];
  statusNote: string | null;
  paused: boolean;
  payoutNetwork: string | null;
  payoutNumber: string | null;
  menuItems: number;
  ordersLast30Days: number;
  owner: { firstName: string; lastName: string; email: string | null; phone: string | null; status: string };
}

export interface Settlement {
  vendor: { id: string; name: string; payoutNetwork: string | null; payoutNumber: string | null; payoutName: string | null };
  onlineOrders: number;
  onlineGross: number;
  commission: number;
  dispatchFees: number;
  net: number;
  paidOut: number;
  owed: number;
  counterOrders: number;
  counterGross: number;
  payouts: Array<{ id: string; amount: number; reference: string | null; createdAt: string }>;
}

export interface DispatcherSettlement {
  id: string;
  status: string;
  payoutNetwork: string;
  payoutNumber: string;
  payoutName: string;
  student: { firstName: string; lastName: string; indexNumber: string | null };
  deliveries: number;
  earned: number;
  paidOut: number;
  /** Across all time: everything earned less everything paid. */
  owed: number;
}

export const foodApi = {
  vendors: () => api.get<Array<VendorPublic & { itemsAvailable: number }>>('/food/vendors').then((r) => r.data),
  menu: (id: string) => api.get<VendorMenu>(`/food/vendors/${id}`).then((r) => r.data),
  place: (dto: { vendorId: string; lines: Array<{ menuItemId: string; quantity: number }>; fulfilment: 'PICKUP' | 'DELIVERY'; paymentOption: 'ONLINE' | 'ON_PICKUP'; deliveryAddress?: string; deliveryNote?: string; note?: string }) =>
    api.post<{ orderId: string; number: number; paymentUrl?: string; provider?: string }>('/food/orders', dto).then((r) => r.data),
  orders: (page: number) => api.get<{ items: Order[]; total: number; page: number; pageSize: number }>('/food/orders', { params: { page, pageSize: 20 } }).then((r) => r.data),
  order: (id: string) => api.get<Order>(`/food/orders/${id}`).then((r) => r.data),
  cancel: (id: string) => api.post<Order>(`/food/orders/${id}/cancel`).then((r) => r.data),
  pay: (id: string) => api.post<{ paymentUrl: string }>(`/food/orders/${id}/pay`).then((r) => r.data),

  verifyPayment: (reference: string) => api.get<{ status: string; orderId: string | null; amount: number; purpose: string }>(`/payments/${encodeURIComponent(reference)}/verify`).then((r) => r.data),
  demoPay: (reference: string, outcome: 'success' | 'failed') => api.post<{ status: string; orderId: string | null }>(`/payments/${encodeURIComponent(reference)}/demo`, { outcome }).then((r) => r.data),

  myVendor: () => api.get<MyVendor>('/vendor').then((r) => r.data),
  saveProfile: (dto: VendorProfileInput) => api.put('/vendor/profile', dto),
  pause: (paused: boolean) => api.post('/vendor/pause', { paused }),
  saveCategory: (name: string, id?: string) => (id ? api.patch(`/vendor/categories/${id}`, { name }) : api.post('/vendor/categories', { name })),
  deleteCategory: (id: string) => api.delete(`/vendor/categories/${id}`),
  saveItem: (dto: { name: string; description?: string; price: number; categoryId?: string | null; isAvailable?: boolean; tags?: string[] }, id?: string) =>
    id ? api.patch(`/vendor/items/${id}`, dto) : api.post('/vendor/items', dto),
  setAvailable: (id: string, isAvailable: boolean) => api.post(`/vendor/items/${id}/availability`, { isAvailable }),
  deleteItem: (id: string) => api.delete(`/vendor/items/${id}`),
  board: () => api.get<Board>('/vendor/orders').then((r) => r.data),
  act: (id: string, to: string, extra: { reason?: string; code?: string } = {}) => api.post<Order>(`/vendor/orders/${id}/action`, { to, ...extra }).then((r) => r.data),

  adminVendors: () => api.get<AdminVendor[]>('/marketplace/vendors').then((r) => r.data),
  createVendor: (dto: { firstName: string; lastName: string; email: string; phone: string; vendorName: string; location: string }) => api.post('/marketplace/vendors', dto),
  review: (id: string, status: 'APPROVED' | 'SUSPENDED' | 'REJECTED', note?: string) => api.post(`/marketplace/vendors/${id}/review`, { status, note }),
  settings: () => api.get<{ commissionPercent: number; unpaidMinutes: number }>('/marketplace/settings').then((r) => r.data),
  saveSettings: (dto: { commissionPercent: number; unpaidMinutes: number }) => api.put('/marketplace/settings', dto),
  settlements: (from: string, to: string) => api.get<Settlement[]>('/marketplace/settlements', { params: { from, to } }).then((r) => r.data),
  dispatcherSettlements: (from: string, to: string) => api.get<DispatcherSettlement[]>('/marketplace/dispatcher-settlements', { params: { from, to } }).then((r) => r.data),
  recordDispatcherPayout: (dto: { dispatcherId: string; periodFrom: string; periodTo: string; amount: number; reference?: string }) => api.post('/marketplace/dispatcher-payouts', dto),
  recordPayout: (dto: { vendorId: string; periodFrom: string; periodTo: string; amount: number; reference?: string; note?: string }) => api.post('/marketplace/payouts', dto),
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  PENDING_PAYMENT: 'warning', PLACED: 'primary', ACCEPTED: 'primary', READY: 'success', OUT_FOR_DELIVERY: 'success', COMPLETED: 'neutral', CANCELLED: 'danger', REJECTED: 'danger',
};
export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' });
