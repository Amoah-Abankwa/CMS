import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';
import type { Offering } from '@/features/offerings/api';

export type RegistrationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface AvailableOffering extends Offering {
  stage: number;
  isMain: boolean;
  isElective: boolean;
  passed: boolean;
  seatsTaken: number;
  /** Failed at the latest attempt; must be taken again. */
  carryOver?: boolean;
}

export interface MyRegistration {
  semester: Semester;
  profile: { level: number; programme: { code: string; name: string } };
  available: AvailableOffering[];
  mode: 'REGULAR' | 'PROMOTIONAL' | 'UPGRADE' | 'SUMMER_NOT_SET';
  mainStage: number | null;
  suggestedStage: number;
  totalStages: number;
  weekend: boolean;
  registration: {
    mainStage?: number | null;
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
  mine: (mainStage?: number) => api.get<MyRegistration>('/me/registration', { params: mainStage ? { mainStage } : {} }).then((r) => r.data),
  save: (offeringIds: string[], mainStage?: number | null) => api.put<MyRegistration>('/me/registration', { offeringIds, mainStage: mainStage ?? undefined }).then((r) => r.data),
  courses: () => api.get<MyCourse[]>('/me/registration/courses').then((r) => r.data),
  submit: () => api.post<MyRegistration>('/me/registration/submit').then((r) => r.data),
  withdraw: () => api.post<MyRegistration>('/me/registration/withdraw').then((r) => r.data),

  review: (params: { semesterId?: string; status?: RegistrationStatus; search?: string; page: number; pageSize?: number }) =>
    api.get<ReviewPage>('/registrations', { params }).then((r) => r.data),
  approve: (id: string, note?: string) => api.post<ReviewItem>(`/registrations/${id}/approve`, { note: note || undefined }).then((r) => r.data),
  reopen: (id: string, reason: string) => api.post(`/registrations/${id}/reopen`, { reason }),
  reject: (id: string, note: string) => api.post<ReviewItem>(`/registrations/${id}/reject`, { note }).then((r) => r.data),
};

export interface MyCourse {
  offeringId: string;
  course: { id: string; code: string; title: string; creditHours: number };
  term: string;
  startDate: string;
  status: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'IN_PROGRESS' | 'AWAITING_APPROVAL';
  grade: string | null;
  total: number | null;
}
