import type { PriorityGroup } from '@anu/shared';
import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';

export type HostelGender = 'MALE' | 'FEMALE' | 'MIXED';
export type AllocationStatus = 'PROVISIONAL' | 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
export type BookingStatus = 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface HostelInput {
  name: string;
  gender: HostelGender;
  location?: string;
  digitalAddress?: string;
  distanceNote?: string;
  description?: string;
  facilities?: string[];
  contactPhone?: string;
  isActive?: boolean;
}

export interface UniversityHostel extends HostelInput {
  id: string;
  rooms: number;
  beds: number;
  accepted: number;
  offered: number;
  provisional: number;
  free: number;
  roomTypes: string[];
  facilities: string[];
}

export interface RoomRow {
  id: string;
  number: string;
  floor: string | null;
  capacity: number;
  roomType: string;
  pricePerSemester: number;
  isActive: boolean;
  notes: string | null;
  allocations: Array<{ id: string; status: AllocationStatus; acceptBy: string | null; student: { id: string; indexNumber: string; firstName: string; lastName: string } }>;
}

export interface Round {
  semester: Semester;
  round: { opensAt: string; closesAt: string; acceptanceDays: number; lastRunAt: string | null; lastPublishedAt: string | null } | null;
  open: boolean;
}

export interface ApplicationRow {
  id: string;
  status: 'SUBMITTED' | 'WITHDRAWN' | 'ALLOCATED' | 'UNPLACED';
  submittedAt: string;
  acceptAny: boolean;
  specialNeeds: string | null;
  specialNeedsApproved: boolean;
  group: PriorityGroup;
  preferences: Array<{ hostelId: string; hostelName: string; roomType: string | null }>;
  student: { id: string; indexNumber: string; firstName: string; lastName: string; studentProfile: { gender: string | null; currentLevel: number; programme: { name: string } } | null };
}

export interface AllocationRow {
  id: string;
  status: AllocationStatus;
  source: 'AUTO' | 'MANUAL';
  preferenceRank: number | null;
  offeredAt: string | null;
  acceptBy: string | null;
  student: { id: string; indexNumber: string; firstName: string; lastName: string; studentProfile: { gender: string | null; currentLevel: number } | null };
  room: { id: string; number: string; roomType: string; pricePerSemester: number; capacity: number; hostel: { id: string; name: string } };
}

export interface RunSummary {
  applicants: number;
  placed: number;
  firstChoice: number;
  anyHostel: number;
  unplaced: { noBed: number; noGender: number };
}

export interface RoomType {
  id: string;
  name: string;
  bedsPerRoom: number;
  pricePerSemester: number;
  availableBeds: number;
  description: string | null;
  isActive?: boolean;
}

export interface PrivateHostel {
  photoUrls?: string[];
  id: string;
  name: string;
  gender: HostelGender;
  location: string | null;
  digitalAddress: string | null;
  distanceNote: string | null;
  description: string | null;
  facilities: string[];
  contactPhone: string | null;
  isActive?: boolean;
  verification?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  verificationNote?: string | null;
  owner?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string } | null;
  roomTypes: RoomType[];
}

export interface MyAccommodation {
  semester: { id: string; label: string };
  round: { opensAt: string; closesAt: string; acceptanceDays: number } | null;
  applicationsOpen: boolean;
  gender: 'MALE' | 'FEMALE' | null;
  application: { id: string; status: ApplicationRow['status']; preferences: Array<{ hostelId: string; roomType: string | null }>; acceptAny: boolean; specialNeeds: string | null; specialNeedsApproved: boolean; submittedAt: string } | null;
  allocation: { id: string; status: 'OFFERED' | 'ACCEPTED'; acceptBy: string | null; room: { number: string; roomType: string; pricePerSemester: number; floor: string | null; hostel: { name: string; location: string | null } } } | null;
  bookings: Array<{ id: string; status: BookingStatus; message: string | null; ownerNote: string | null; createdAt: string; roomType: { name: string; pricePerSemester: number; hostel: { name: string; location: string | null; contactPhone: string | null } } }>;
  declaration: { address: string; digitalAddress: string | null; landmark: string | null } | null;
  hostels: Array<{ id: string; name: string; gender: HostelGender; location: string | null; facilities: string[]; roomTypes: Array<{ roomType: string; pricePerSemester: number }> }>;
  residence: { kind: 'UNIVERSITY' | 'PRIVATE' | 'OFF_CAMPUS' | 'UNKNOWN'; label: string | null };
}

export interface OwnerBooking {
  id: string;
  status: BookingStatus;
  message: string | null;
  ownerNote: string | null;
  createdAt: string;
  respondedAt: string | null;
  roomType: { id: string; name: string; availableBeds: number; hostel: { name: string } };
  student: { firstName: string; lastName: string; phone: string | null; email: string | null; indexNumber: string | null };
}

export interface ResidenceRow {
  id: string;
  indexNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  programme: string | null;
  level: number | null;
  kind: MyAccommodation['residence']['kind'];
  where: string | null;
}

export const accommodationApi = {
  // Hostel Office
  university: (semesterId?: string) => api.get<{ semester: Semester; items: UniversityHostel[] }>('/hostels', { params: { semesterId } }).then((r) => r.data),
  saveHostel: (dto: HostelInput, id?: string) => (id ? api.patch(`/hostels/${id}`, dto) : api.post('/hostels', dto)).then((r) => r.data),
  rooms: (hostelId: string, semesterId?: string) =>
    api.get<{ semester: Semester; hostel: UniversityHostel; rooms: RoomRow[] }>(`/hostels/${hostelId}/rooms`, { params: { semesterId } }).then((r) => r.data),
  addRooms: (hostelId: string, dto: { prefix: string; from: number; to: number; floor?: string; capacity: number; roomType: string; pricePerSemester: number }) =>
    api.post<{ added: number; skipped: number }>(`/hostels/${hostelId}/rooms`, dto).then((r) => r.data),
  updateRoom: (roomId: string, dto: { capacity: number; roomType: string; pricePerSemester: number; isActive: boolean; notes?: string }) => api.patch(`/hostels/rooms/${roomId}`, dto),
  round: (semesterId?: string) => api.get<Round>('/hostels/round', { params: { semesterId } }).then((r) => r.data),
  saveRound: (dto: { semesterId?: string; opensAt: string; closesAt: string; acceptanceDays: number }) => api.put('/hostels/round', dto),
  applications: (params: { semesterId?: string; status?: string; search?: string; page: number; pageSize?: number }) =>
    api.get<{ semester: Semester; counts: Record<string, number>; total: number; page: number; pageSize: number; items: ApplicationRow[] }>('/hostels/applications', { params }).then((r) => r.data),
  specialNeeds: (id: string, approved: boolean) => api.post(`/hostels/applications/${id}/special-needs`, { approved }),
  run: (semesterId?: string) => api.post<RunSummary>('/hostels/allocation/run', { semesterId }).then((r) => r.data),
  allocations: (semesterId?: string) => api.get<{ semester: Semester; items: AllocationRow[] }>('/hostels/allocations', { params: { semesterId } }).then((r) => r.data),
  publish: (semesterId?: string) => api.post<{ offered: number; waiting: number; acceptBy: string }>('/hostels/allocation/publish', { semesterId }).then((r) => r.data),
  manual: (indexNumber: string, roomId: string, semesterId?: string) => api.post('/hostels/allocations', { indexNumber, roomId, semesterId }),
  move: (id: string, roomId: string) => api.post(`/hostels/allocations/${id}/move`, { roomId }),
  cancelAllocation: (id: string, reason: string) => api.post(`/hostels/allocations/${id}/cancel`, { reason }),
  privateHostels: () => api.get<PrivateHostel[]>('/hostels/private').then((r) => r.data),
  verify: (id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED', note?: string) => api.post(`/hostels/${id}/verify`, { status, note }),
  owners: () =>
    api
      .get<Array<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string; ownedHostels: Array<{ id: string; name: string; verification: string }> }>>('/hostels/owners')
      .then((r) => r.data),
  createOwner: (dto: { firstName: string; lastName: string; email: string; phone: string }) => api.post('/hostels/owners', dto),

  // Student
  mine: () => api.get<MyAccommodation>('/me/accommodation').then((r) => r.data),
  apply: (dto: { preferences: Array<{ hostelId: string; roomType: string | null }>; acceptAny: boolean; specialNeeds?: string; gender?: 'Female' | 'Male'; roommateIndex?: string | null }) => api.put('/me/accommodation/application', dto),
  roommate: () => api.get<{ roommateIndex: string | null; mutual: boolean }>('/me/accommodation/roommate').then((r) => r.data),
  withdraw: () => api.post('/me/accommodation/application/withdraw'),
  respond: (accept: boolean) => api.post<MyAccommodation>(`/me/accommodation/offer/${accept ? 'accept' : 'decline'}`).then((r) => r.data),
  browsePrivate: () => api.get<PrivateHostel[]>('/me/accommodation/private').then((r) => r.data),
  book: (roomTypeId: string, message?: string) => api.post('/me/accommodation/bookings', { roomTypeId, message }),
  cancelBooking: (id: string) => api.post(`/me/accommodation/bookings/${id}/cancel`),
  declare: (dto: { address: string; digitalAddress?: string; landmark?: string }) => api.put('/me/accommodation/residence', dto),

  // Private hostel owner
  myHostels: () => api.get<PrivateHostel[]>('/my-hostels').then((r) => r.data),
  saveMyHostel: (dto: HostelInput, id?: string) => (id ? api.patch(`/my-hostels/${id}`, dto) : api.post('/my-hostels', dto)).then((r) => r.data),
  saveRoomType: (hostelId: string, dto: Omit<RoomType, 'id'>, id?: string) => (id ? api.patch(`/my-hostels/${hostelId}/room-types/${id}`, dto) : api.post(`/my-hostels/${hostelId}/room-types`, dto)).then((r) => r.data),
  ownerBookings: (status?: string) => api.get<OwnerBooking[]>('/my-hostels/bookings', { params: { status } }).then((r) => r.data),
  respondBooking: (id: string, accept: boolean, note?: string) => api.post(`/my-hostels/bookings/${id}/${accept ? 'accept' : 'decline'}`, { note }),

  // Oversight
  residence: (params: { semesterId?: string; kind?: string; search?: string; page: number; pageSize?: number }) =>
    api.get<{ semester: Semester; counts: Record<string, number>; total: number; page: number; pageSize: number; items: ResidenceRow[] }>('/accommodation/residence', { params }).then((r) => r.data),
};

export const ALLOCATION_LABEL: Record<AllocationStatus, string> = {
  PROVISIONAL: 'Provisional', OFFERED: 'Offered', ACCEPTED: 'Accepted', DECLINED: 'Declined', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
};
export const ALLOCATION_TONE: Record<AllocationStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  PROVISIONAL: 'neutral', OFFERED: 'primary', ACCEPTED: 'success', DECLINED: 'warning', EXPIRED: 'warning', CANCELLED: 'danger',
};
export const BOOKING_LABEL: Record<BookingStatus, string> = { REQUESTED: 'Waiting for owner', ACCEPTED: 'Accepted', DECLINED: 'Declined', CANCELLED: 'Cancelled' };
export const BOOKING_TONE: Record<BookingStatus, 'neutral' | 'primary' | 'success' | 'danger'> = { REQUESTED: 'primary', ACCEPTED: 'success', DECLINED: 'danger', CANCELLED: 'neutral' };
export const GENDER_LABEL: Record<HostelGender, string> = { MALE: 'Male', FEMALE: 'Female', MIXED: 'Mixed' };
export const RESIDENCE_LABEL: Record<ResidenceRow['kind'], string> = { UNIVERSITY: 'University hostel', PRIVATE: 'Private hostel', OFF_CAMPUS: 'Off campus', UNKNOWN: 'Not declared' };

/** Cedis typed by a person to pesewas stored by the API. */
export const toPesewas = (cedis: string | number) => Math.round(Number(cedis) * 100);
