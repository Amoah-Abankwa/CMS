import type { TimetableIssue } from '@anu/shared';
import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';

export interface Venue {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  isActive: boolean;
}

export interface Paper {
  id: string;
  offeringId: string;
  course: { code: string; title: string; department: { name: string } };
  startsAt: string;
  durationMinutes: number;
  venue: { id: string; name: string; capacity: number } | null;
  notes: string | null;
  students: number;
  invigilators: Array<{ id: string; name: string }>;
  changedSincePublish: boolean;
}

export interface TimetableView {
  semester: Semester;
  timetable: { id: string; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null; publishedVersion: number };
  sessions: Paper[];
  unscheduled: Array<{ offeringId: string; course: { code: string; title: string; department: { name: string } }; students: number }>;
  issues: TimetableIssue[];
  pendingChanges: number;
  notified?: number;
}

export interface PaperInput {
  offeringId: string;
  startsAt: string;
  durationMinutes: number;
  venueId: string | null;
  invigilatorIds: string[];
  notes?: string;
}

export interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  staffProfile: { department: { name: string } | null } | null;
}

export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE';

export interface EligibilityPaper {
  id: string;
  offering: { id: string; course: { code: string; title: string } };
  status: EligibilityStatus;
  reasons: Array<{ code: string; text: string }>;
  ruleStatus: EligibilityStatus;
  override: { status: EligibilityStatus; reason: string | null; at: string | null } | null;
  publishedStatus: EligibilityStatus | null;
  unpublished: boolean;
}

export interface EligibilityView {
  semester: Semester;
  policy: { requireFinancialClearance: boolean; requireMinimumAttendance: boolean };
  meta: { generatedAt: string | null; publishedAt: string | null; publishedVersion: number };
  counts: { students: number; fullyEligible: number; withIssues: number; unpublished: number };
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    student: { id: string; indexNumber: string; firstName: string; lastName: string; studentProfile: { programme: { name: string } } | null };
    papers: EligibilityPaper[];
    notEligible: number;
  }>;
}

export interface ClearanceView {
  semester: Semester;
  items: Array<{
    id: string;
    indexNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    studentProfile: { currentLevel: number; programme: { name: string } } | null;
    clearance: { cleared: boolean; note: string | null; updatedAt: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  counts: { students: number; cleared: number; notCleared: number };
}

export type HoldCategory = 'DISCIPLINARY' | 'ACADEMIC_MISCONDUCT' | 'ADMINISTRATIVE' | 'OTHER';

export interface Hold {
  id: string;
  category: HoldCategory;
  reason: string;
  createdAt: string;
  liftedAt: string | null;
  liftReason: string | null;
  placedBy: string | null;
  student: { id: string; indexNumber: string; firstName: string; lastName: string };
  offering: { id: string; course: { code: string; title: string } } | null;
}

export interface MyExams {
  semester: { id: string; label: string };
  timetablePublishedAt: string | null;
  eligibilityPublishedAt: string | null;
  papers: Array<{
    offeringId: string;
    course: { code: string; title: string; creditHours: number };
    exam: { startsAt: string; durationMinutes: number; venue: string | null; notes: string | null } | null;
    seatNumber?: number | null;
    eligibility: { status: EligibilityStatus; reasons: string[] } | null;
  }>;
}

export const examsApi = {
  venues: () => api.get<Venue[]>('/exams/venues').then((r) => r.data),
  saveVenue: (v: Omit<Venue, 'id'>, id?: string) => (id ? api.patch<Venue>(`/exams/venues/${id}`, v) : api.post<Venue>('/exams/venues', v)).then((r) => r.data),

  timetable: (semesterId?: string) => api.get<TimetableView>('/exams/timetable', { params: { semesterId } }).then((r) => r.data),
  staffOptions: () => api.get<StaffOption[]>('/exams/invigilator-options').then((r) => r.data),
  savePaper: (p: PaperInput) => api.put<TimetableView>('/exams/timetable/papers', p).then((r) => r.data),
  removePaper: (id: string) => api.delete<TimetableView>(`/exams/timetable/papers/${id}`).then((r) => r.data),
  publishTimetable: (semesterId?: string) => api.post<TimetableView>('/exams/timetable/publish', { semesterId }).then((r) => r.data),

  eligibility: (params: { semesterId?: string; filter?: string; search?: string; page: number; pageSize?: number }) =>
    api.get<EligibilityView>('/exams/eligibility', { params }).then((r) => r.data),
  setPolicy: (policy: { requireFinancialClearance: boolean; requireMinimumAttendance: boolean }) => api.put('/exams/eligibility/policy', policy),
  generate: (semesterId?: string) => api.post<EligibilityView>('/exams/eligibility/generate', { semesterId }).then((r) => r.data),
  publishEligibility: (semesterId?: string) => api.post<{ notified: number }>('/exams/eligibility/publish', { semesterId }).then((r) => r.data),
  override: (id: string, status: EligibilityStatus, reason: string) => api.post(`/exams/eligibility/${id}/override`, { status, reason }),
  clearOverride: (id: string) => api.delete(`/exams/eligibility/${id}/override`),

  clearance: (params: { semesterId?: string; status?: string; search?: string; page: number; pageSize?: number }) =>
    api.get<ClearanceView>('/exams/clearance', { params }).then((r) => r.data),
  setClearance: (indexNumbers: string[], cleared: boolean, note?: string, semesterId?: string) =>
    api.put<{ updated: number; notFound: string[] }>('/exams/clearance', { indexNumbers, cleared, note, semesterId }).then((r) => r.data),

  holds: (semesterId?: string) => api.get<{ semester: Semester; items: Hold[] }>('/exams/holds', { params: { semesterId } }).then((r) => r.data),
  holdStudent: (indexNumber: string) =>
    api
      .get<{ student: { id: string; indexNumber: string; firstName: string; lastName: string }; offerings: Array<{ id: string; course: { code: string; title: string } }> }>(
        `/exams/holds/student/${encodeURIComponent(indexNumber)}`,
      )
      .then((r) => r.data),
  placeHold: (dto: { indexNumber: string; offeringId?: string; category: HoldCategory; reason: string }) => api.post('/exams/holds', dto),
  liftHold: (id: string, reason: string) => api.post(`/exams/holds/${id}/lift`, { reason }),

  mine: () => api.get<MyExams>('/me/exams').then((r) => r.data),
};

export const HOLD_LABELS: Record<HoldCategory, string> = {
  DISCIPLINARY: 'Disciplinary',
  ACADEMIC_MISCONDUCT: 'Academic misconduct',
  ADMINISTRATIVE: 'Administrative',
  OTHER: 'Other',
};

const TZ = 'Africa/Accra';
export const examDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const examTime = (iso: string, minutes: number) => {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${t(start)} to ${t(end)}`;
};
