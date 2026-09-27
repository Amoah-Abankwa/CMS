import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';
import type { Offering, RosterStudent } from '@/features/offerings/api';

export const teachingApi = {
  classes: (semesterId?: string) => api.get<{ semester: Semester; items: Offering[] }>('/teaching/classes', { params: { semesterId } }).then((r) => r.data),
  roster: (id: string) =>
    api.get<{ offering: Offering; semesterLabel: string; students: RosterStudent[] }>(`/teaching/classes/${id}/roster`).then((r) => r.data),
};
