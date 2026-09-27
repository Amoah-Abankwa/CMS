import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';

export interface Offering {
  id: string;
  capacity: number | null;
  semesterId: string;
  enrolled: number;
  course: { id: string; code: string; title: string; creditHours: number; level: number; department: { id: string; name: string } };
  lecturers: Array<{ id: string; name: string; isLead: boolean }>;
}

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
  school: { name: string };
}

export interface CourseOption {
  id: string;
  code: string;
  title: string;
  creditHours: number;
  level: number;
  semesterNo: number;
}

export interface LecturerOption {
  id: string;
  firstName: string;
  lastName: string;
  staffProfile: { title: string | null; department: { name: string } | null } | null;
}

export interface RosterStudent {
  id: string;
  indexNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  studentProfile: { currentLevel: number; programme: { code: string; name: string } } | null;
}

export const offeringsApi = {
  list: (params: { semesterId?: string; departmentId?: string; search?: string }) =>
    api.get<{ semester: Semester; items: Offering[] }>('/offerings', { params }).then((r) => r.data),
  departments: () => api.get<DepartmentOption[]>('/offerings/departments').then((r) => r.data),
  courseOptions: (semesterId: string, departmentId?: string) =>
    api.get<CourseOption[]>('/offerings/course-options', { params: { semesterId, departmentId } }).then((r) => r.data),
  lecturerOptions: () => api.get<LecturerOption[]>('/offerings/lecturer-options').then((r) => r.data),
  create: (semesterId: string, courseId: string, capacity?: number) => api.post<Offering>('/offerings', { semesterId, courseId, capacity }).then((r) => r.data),
  createForDepartment: (semesterId: string, departmentId: string) =>
    api.post<{ created: number; alreadyOffered: number }>('/offerings/department', { semesterId, departmentId }).then((r) => r.data),
  updateCapacity: (id: string, capacity: number | null) => api.patch<Offering>(`/offerings/${id}`, { capacity }).then((r) => r.data),
  setLecturers: (id: string, lecturers: Array<{ userId: string; isLead: boolean }>) =>
    api.put<Offering>(`/offerings/${id}/lecturers`, { lecturers }).then((r) => r.data),
  remove: (id: string) => api.delete(`/offerings/${id}`),
};

export function lecturerName(l: LecturerOption) {
  return [l.staffProfile?.title, l.firstName, l.lastName].filter(Boolean).join(' ');
}
