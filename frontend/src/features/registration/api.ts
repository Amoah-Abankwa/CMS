import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';
import type { Offering } from '@/features/offerings/api';

export type RegistrationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface AvailableOffering extends Offering {
  seatsTaken: number;
}

export interface MyRegistration {
  semester: Semester;
  profile: { level: number; programme: { code: string; name: string } };
  available: AvailableOffering[];
  registration: {
    id: string;
    status: RegistrationStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
    reviewedBy: string | null;
    offeringIds: string[];
  } | null;
}

export interface ReviewItem {
  id: string;
  status: RegistrationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  credits: number;
  courses: Array<{ code: string; title: string; creditHours: number }>;
  student: {
    id: string;
    indexNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    studentProfile: { currentLevel: number; programme: { code: string; name: string } } | null;
  };
}

export interface ReviewPage {
  semester: Semester;
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<RegistrationStatus, number>>;
}

export const registrationApi = {
  mine: () => api.get<MyRegistration>('/me/registration').then((r) => r.data),
  save: (offeringIds: string[]) => api.put<MyRegistration>('/me/registration', { offeringIds }).then((r) => r.data),
  submit: () => api.post<MyRegistration>('/me/registration/submit').then((r) => r.data),
  withdraw: () => api.post<MyRegistration>('/me/registration/withdraw').then((r) => r.data),

  review: (params: { semesterId?: string; status?: RegistrationStatus; search?: string; page: number; pageSize?: number }) =>
    api.get<ReviewPage>('/registrations', { params }).then((r) => r.data),
  approve: (id: string, note?: string) => api.post<ReviewItem>(`/registrations/${id}/approve`, { note: note || undefined }).then((r) => r.data),
  reject: (id: string, note: string) => api.post<ReviewItem>(`/registrations/${id}/reject`, { note }).then((r) => r.data),
};
