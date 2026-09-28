import { api } from '@/lib/axios';

export interface ProgrammeOption {
  id: string;
  code: string;
  name: string;
  levelCode: string;
  level: { name: string };
  department: { name: string; school: { name: string } };
}

export interface StudentRow {
  id: string;
  indexNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  isDemo: boolean;
  studentProfile: { admissionYear: number; currentLevel: number; programme: { code: string; name: string } } | null;
}

export interface RegisterStudentInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  programmeId: string;
  admissionYear: number;
  dateOfBirth?: string;
  gender?: 'Female' | 'Male';
  nationality?: string;
}

export interface RegisteredStudent {
  id: string;
  indexNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
}

export const studentsApi = {
  setStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', reason: string) => api.post<{ status: string }>(`/students/${id}/status`, { status, reason }).then((r) => r.data),
  resendSetup: (id: string) => api.post(`/students/${id}/resend-setup`),
  programmes: () => api.get<ProgrammeOption[]>('/academics/programmes').then((r) => r.data),
  list: (params: { page: number; pageSize?: number; search?: string; programmeId?: string; admissionYear?: number }) =>
    api.get<{ items: StudentRow[]; total: number; page: number; pageSize: number }>('/students', { params }).then((r) => r.data),
  register: (input: RegisterStudentInput) => api.post<RegisteredStudent>('/students', input).then((r) => r.data),
};
