import type { DevotionPolicy } from '@anu/shared';
import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';

export type DevotionStatus = 'EARLY' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface ServiceTimes {
  opensAt: string;
  startsAt: string;
  lateFrom: string;
  endsAt: string;
}

export interface DevotionServiceRow extends ServiceTimes {
  id: string;
  date: string;
  theme: string | null;
  speaker: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  closedAt: string | null;
  live: boolean;
  counts: { early: number; late: number; absent: number; excused: number };
}

export interface Screen extends ServiceTimes {
  date: string;
  theme: string | null;
  speaker: string | null;
  early: number;
  late: number;
  expected: number;
  phase: 'NOT_OPEN' | 'EARLY' | 'LATE' | 'ENDED' | 'CANCELLED';
  code: string | null;
  secondsLeft?: number;
  qrDataUrl?: string;
}

export interface ServiceRecords {
  service: ServiceTimes & { id: string; date: string; theme: string | null; speaker: string | null; closedAt: string | null; cancelledAt: string | null };
  items: Array<{ id: string; indexNumber: string; firstName: string; lastName: string; record: { status: DevotionStatus; source: string; arrivedAt: string | null; note: string | null } | null }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface ScoreSummary {
  early: number;
  late: number;
  absent: number;
  excused: number;
  counted: number;
  score: number | null;
}

export interface ScoresView {
  semester: Semester;
  policy: DevotionPolicy;
  finalizedAt: string | null;
  stats: { students: number; average: number | null; full: number };
  total: number;
  page: number;
  pageSize: number;
  items: Array<ScoreSummary & { id: string; indexNumber: string; firstName: string; lastName: string; studentProfile: { currentLevel: number; programme: { name: string } } | null; finalScore: number | null }>;
}

export interface MyDevotion {
  semester: { id: string; label: string };
  expected: boolean;
  policy: DevotionPolicy;
  summary: ScoreSummary;
  final: { score: number; totalMarks: number; finalizedAt: string } | null;
  history: Array<{ id: string; date: string; theme: string | null; status: DevotionStatus; arrivedAt: string | null }>;
  next: (ServiceTimes & { id: string; date: string; theme: string | null }) | null;
}

export const devotionApi = {
  policy: () => api.get<DevotionPolicy>('/devotion/policy').then((r) => r.data),
  setPolicy: (p: DevotionPolicy) => api.put<DevotionPolicy>('/devotion/policy', p).then((r) => r.data),
  services: (semesterId?: string) => api.get<{ semester: Semester; expected: number; items: DevotionServiceRow[] }>('/devotion/services', { params: { semesterId } }).then((r) => r.data),
  generate: (semesterId?: string) => api.post<{ created: number; alreadyScheduled: number }>('/devotion/services/generate', { semesterId }).then((r) => r.data),
  addService: (date: string, theme?: string, speaker?: string) => api.post('/devotion/services', { date, theme, speaker }),
  updateService: (id: string, theme?: string, speaker?: string) => api.patch(`/devotion/services/${id}`, { theme, speaker }),
  cancelService: (id: string, reason: string) => api.post(`/devotion/services/${id}/cancel`, { reason }),
  screen: (id: string) => api.get<Screen>(`/devotion/services/${id}/screen`).then((r) => r.data),
  door: (id: string, indexNumber: string) =>
    api
      .post<{ student: { indexNumber: string; firstName: string; lastName: string }; status: DevotionStatus; arrivedAt: string; alreadyRecorded: boolean }>(`/devotion/services/${id}/door`, { indexNumber })
      .then((r) => r.data),
  records: (id: string, params: { status?: string; search?: string; page: number; pageSize?: number }) => api.get<ServiceRecords>(`/devotion/services/${id}/records`, { params }).then((r) => r.data),
  correct: (id: string, studentId: string, status: 'EARLY' | 'LATE' | 'ABSENT', reason: string) => api.put(`/devotion/services/${id}/records/${studentId}`, { status, reason }),
  close: (id: string) => api.post(`/devotion/services/${id}/close`),
  scores: (params: { semesterId?: string; search?: string; page: number; pageSize?: number }) => api.get<ScoresView>('/devotion/scores', { params }).then((r) => r.data),
  finalise: (semesterId?: string) => api.post<{ students: number; notified: number }>('/devotion/scores/finalise', { semesterId }).then((r) => r.data),
  mine: () => api.get<MyDevotion>('/me/devotion').then((r) => r.data),
  checkIn: (code: string) => api.post<{ status: DevotionStatus; arrivedAt: string; alreadyRecorded: boolean }>('/me/devotion/check-in', { code }).then((r) => r.data),
};

export const DEVOTION_LABEL: Record<DevotionStatus, string> = { EARLY: 'Early', LATE: 'Late', ABSENT: 'Absent', EXCUSED: 'Excused' };
export const DEVOTION_TONE: Record<DevotionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { EARLY: 'success', LATE: 'warning', ABSENT: 'danger', EXCUSED: 'neutral' };

const TZ = 'Africa/Accra';
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const serviceDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
export const marks = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(2));
