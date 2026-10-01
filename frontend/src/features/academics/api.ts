import { api } from '@/lib/axios';

export interface Semester {
  id: string;
  number: number;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationOpen: boolean;
  minCredits: number;
  maxCredits: number;
  academicYear: { id: string; label: string };
}

export interface SemesterUpdate {
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  minCredits?: number;
  maxCredits?: number;
  isCurrent?: boolean;
}

export interface AcademicYearRow {
  id: string; label: string; startDate: string; endDate: string; isCurrent: boolean;
  semesters: Array<{ id: string; number: number; startDate: string; endDate: string; isCurrent: boolean; summerKind: 'PROMOTIONAL' | 'UPGRADE' | null }>;
}

export const academicsApi = {
  semesters: () => api.get<Semester[]>('/academics/semesters').then((r) => r.data),
  years: () => api.get<AcademicYearRow[]>('/academics/years').then((r) => r.data),
  createYear: (dto: { label: string; startDate: string; endDate: string }) => api.post('/academics/years', dto),
  updateYear: (id: string, dto: { startDate: string; endDate: string }) => api.patch(`/academics/years/${id}`, dto),
  deleteYear: (id: string) => api.delete(`/academics/years/${id}`),
  createSemester: (yearId: string, dto: { number: number; startDate: string; endDate: string }) => api.post(`/academics/years/${yearId}/semesters`, dto),
  deleteSemester: (id: string) => api.delete(`/academics/semesters/${id}`),
  setSummerKind: (id: string, summerKind: 'PROMOTIONAL' | 'UPGRADE') => api.patch(`/academics/semesters/${id}`, { summerKind }),
  updateSemester: (id: string, dto: SemesterUpdate) => api.patch<Semester>(`/academics/semesters/${id}`, dto).then((r) => r.data),
};
