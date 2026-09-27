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

export const academicsApi = {
  semesters: () => api.get<Semester[]>('/academics/semesters').then((r) => r.data),
  updateSemester: (id: string, dto: SemesterUpdate) => api.patch<Semester>(`/academics/semesters/${id}`, dto).then((r) => r.data),
};
