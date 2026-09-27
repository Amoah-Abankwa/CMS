import type { AttendancePolicy } from '@anu/shared';
import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';
import type { RosterStudent } from '@/features/offerings/api';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type SessionKind = 'LECTURE' | 'TUTORIAL' | 'PRACTICAL';

export interface Summary {
  present: number;
  late: number;
  absent: number;
  excused: number;
  counted: number;
  percent: number | null;
}

export interface ClassSession {
  id: string;
  startsAt: string;
  durationMinutes: number;
  kind: SessionKind;
  topic: string | null;
  venue: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  checkInClosesAt: string | null;
  attendanceTakenAt: string | null;
  checkInOpen: boolean;
  counts: { present: number; late: number; absent: number; excused: number };
}

export interface ClassAttendance {
  offering: { id: string; course: { code: string; title: string }; semesterLabel: string; semester: { startDate: string; endDate: string } };
  policy: AttendancePolicy;
  sessions: ClassSession[];
  students: Array<RosterStudent & { summary: Summary | null; belowMinimum: boolean }>;
}

export interface Register {
  session: Omit<ClassSession, 'counts'> & { checkInOpen: boolean };
  students: Array<RosterStudent & { status: AttendanceStatus | null; source: string | null; checkedInAt: string | null; excused: boolean }>;
}

export interface CheckInScreen {
  open: boolean;
  code?: string;
  secondsLeft?: number;
  qrDataUrl?: string;
  checkedIn: number;
  rosterSize: number;
  closesAt: string | null;
}

export interface SessionInput {
  startsAt: string;
  durationMinutes: number;
  kind: SessionKind;
  topic?: string;
  venue?: string;
  repeatWeeklyUntil?: string;
}

export interface MyAttendance {
  semester: { id: string; label: string };
  policy: { minimumPercent: number };
  courses: Array<{
    offeringId: string;
    course: { code: string; title: string };
    summary: Summary | null;
    belowMinimum: boolean;
    history: Array<{ id: string; startsAt: string; kind: SessionKind; topic: string | null; status: AttendanceStatus }>;
  }>;
  upcoming: Array<{ id: string; offeringId: string; startsAt: string; durationMinutes: number; kind: SessionKind; venue: string | null; checkInOpen: boolean; course: { code: string; title: string } }>;
}

export type ExcuseCategory = 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';

export interface Excuse {
  id: string;
  fromDate: string;
  toDate: string;
  category: ExcuseCategory;
  note: string;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  recordedBy: string | null;
  student: { id: string; indexNumber: string; firstName: string; lastName: string };
}

export interface CourseReportRow {
  offeringId: string;
  course: { code: string; title: string; department: { name: string } };
  lecturer: string | null;
  students: number;
  classesHeld: number;
  classesWithoutRegister: number;
  averagePercent: number | null;
  belowMinimum: number;
}

const base = (offeringId: string) => `/teaching/classes/${offeringId}`;

export const attendanceApi = {
  overview: (offeringId: string) => api.get<ClassAttendance>(`${base(offeringId)}/attendance`).then((r) => r.data),
  createSessions: (offeringId: string, input: SessionInput) => api.post<ClassAttendance>(`${base(offeringId)}/sessions`, input).then((r) => r.data),
  updateSession: (offeringId: string, id: string, input: SessionInput) => api.patch<ClassAttendance>(`${base(offeringId)}/sessions/${id}`, input).then((r) => r.data),
  cancelSession: (offeringId: string, id: string, reason: string) => api.post<ClassAttendance>(`${base(offeringId)}/sessions/${id}/cancel`, { reason }).then((r) => r.data),
  register: (offeringId: string, id: string) => api.get<Register>(`${base(offeringId)}/sessions/${id}/register`).then((r) => r.data),
  saveRegister: (offeringId: string, id: string, entries: Array<{ studentId: string; status: 'PRESENT' | 'LATE' | 'ABSENT' }>) =>
    api.put<Register>(`${base(offeringId)}/sessions/${id}/register`, { entries }).then((r) => r.data),
  openCheckIn: (offeringId: string, id: string, minutes?: number) => api.post<CheckInScreen>(`${base(offeringId)}/sessions/${id}/check-in/open`, { minutes }).then((r) => r.data),
  checkInScreen: (offeringId: string, id: string) => api.get<CheckInScreen>(`${base(offeringId)}/sessions/${id}/check-in`).then((r) => r.data),
  closeCheckIn: (offeringId: string, id: string) => api.post<Register>(`${base(offeringId)}/sessions/${id}/check-in/close`).then((r) => r.data),

  mine: () => api.get<MyAttendance>('/me/attendance').then((r) => r.data),
  checkIn: (code: string, sessionId?: string) =>
    api.post<{ status: 'PRESENT' | 'LATE'; course: { code: string; title: string }; alreadyRecorded: boolean }>('/me/attendance/check-in', { code, sessionId }).then((r) => r.data),

  policy: () => api.get<AttendancePolicy>('/attendance/policy').then((r) => r.data),
  setPolicy: (p: AttendancePolicy) => api.put<AttendancePolicy>('/attendance/policy', p).then((r) => r.data),

  excuses: (params: { search?: string; page: number; pageSize?: number }) =>
    api.get<{ items: Excuse[]; total: number; page: number; pageSize: number }>('/attendance/excuses', { params }).then((r) => r.data),
  recordExcuse: (dto: { indexNumber: string; fromDate: string; toDate: string; category: ExcuseCategory; note: string }) =>
    api.post<{ coursesAffected: number }>('/attendance/excuses', dto).then((r) => r.data),
  revokeExcuse: (id: string, reason: string) => api.post(`/attendance/excuses/${id}/revoke`, { reason }),

  report: (semesterId?: string) => api.get<{ semester: Semester; policy: AttendancePolicy; items: CourseReportRow[] }>('/attendance/reports', { params: { semesterId } }).then((r) => r.data),
  courseReport: (offeringId: string) =>
    api
      .get<{ offering: { id: string; course: { code: string; title: string }; semesterLabel: string }; policy: AttendancePolicy; students: ClassAttendance['students'] }>(`/attendance/reports/${offeringId}`)
      .then((r) => r.data),
};

export const STATUS_LABEL: Record<AttendanceStatus, string> = { PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent', EXCUSED: 'Excused' };
export const STATUS_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { PRESENT: 'success', LATE: 'warning', ABSENT: 'danger', EXCUSED: 'neutral' };
export const KIND_LABEL: Record<SessionKind, string> = { LECTURE: 'Lecture', TUTORIAL: 'Tutorial', PRACTICAL: 'Practical' };
export const EXCUSE_LABEL: Record<ExcuseCategory, string> = { MEDICAL: 'Medical', BEREAVEMENT: 'Bereavement', OFFICIAL_DUTY: 'Official university duty', OTHER: 'Other' };

const TZ = 'Africa/Accra';
export const classWhen = (iso: string, minutes: number) => {
  const s = new Date(iso);
  const e = new Date(s.getTime() + minutes * 60_000);
  const day = s.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${day}, ${t(s)} to ${t(e)}`;
};
