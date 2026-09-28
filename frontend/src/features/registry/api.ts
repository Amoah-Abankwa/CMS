import { api } from '@/lib/axios';

export type Category = 'DIPLOMA' | 'BACHELORS' | 'GRADUATE' | 'OTHER';
export type Mode = 'REGULAR' | 'WEEKEND' | 'SANDWICH' | 'DISTANCE';
export const CATEGORY_LABEL: Record<Category, string> = { DIPLOMA: 'Diploma', BACHELORS: "Bachelor's", GRADUATE: 'Graduate School', OTHER: 'Other' };
export const MODE_LABEL: Record<Mode, string> = { REGULAR: 'Regular', WEEKEND: 'Weekend', SANDWICH: 'Sandwich', DISTANCE: 'Distance' };

export interface ProgrammeRow { id: string; code: string; name: string; levelCode: string; semesters: number | null; indexCode: string | null; isActive: boolean; departmentId: string; _count: { students: number } }
export interface DepartmentRow { id: string; code: string; name: string; schoolId: string; _count: { courses: number; staff: number }; programmes: ProgrammeRow[] }
export interface SchoolRow { id: string; code: string; name: string; departments: DepartmentRow[] }
export interface ProgrammeType { code: string; name: string; description: string | null; category: Category; mode: Mode; semesters: number; indexFormat: string; isActive: boolean; example: string | null; usesProgrammeCode: boolean; _count: { programmes: number } }

export const registryApi = {
  structure: () => api.get<{ schools: SchoolRow[]; types: ProgrammeType[] }>('/registry/structure').then((r) => r.data),
  saveSchool: (dto: { code: string; name: string }, id?: string) => (id ? api.put(`/registry/schools/${id}`, dto) : api.post('/registry/schools', dto)),
  saveDepartment: (dto: { code: string; name: string; schoolId: string }, id?: string) => (id ? api.put(`/registry/departments/${id}`, dto) : api.post('/registry/departments', dto)),
  deleteDepartment: (id: string) => api.delete(`/registry/departments/${id}`),
  saveProgramme: (dto: { code: string; name: string; departmentId: string; levelCode: string; semesters?: number | null; indexCode?: string | null; isActive?: boolean }, id?: string) => (id ? api.put(`/registry/programmes/${id}`, dto) : api.post('/registry/programmes', dto)),
  deleteProgramme: (id: string) => api.delete(`/registry/programmes/${id}`),
  saveType: (dto: Omit<ProgrammeType, 'example' | '_count' | 'description' | 'usesProgrammeCode'> & { description?: string }, existingCode?: string) => (existingCode ? api.put(`/registry/programme-types/${existingCode}`, dto) : api.post('/registry/programme-types', dto)),
};
