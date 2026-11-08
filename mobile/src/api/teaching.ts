// Generated from frontend/src/features/teaching/api.ts by scripts/mobile/port-api.py. Do not edit here.
import { api } from '@/lib/axios';
import type { Semester } from '@/api/academics';
import type { Offering, RosterStudent } from '@/api/offerings';

export const teachingApi = {
  classes: (semesterId?: string) => api.get<{ semester: Semester; items: Offering[] }>('/teaching/classes', { params: { semesterId } }).then((r) => r.data),
  roster: (id: string) =>
    api.get<{ offering: Offering; semesterLabel: string; students: RosterStudent[] }>(`/teaching/classes/${id}/roster`).then((r) => r.data),
};
