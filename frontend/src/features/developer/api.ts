import { api } from '@/lib/axios';

export interface DeveloperCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  primaryRoleKey: string | null;
  activeGrant: {
    id: string;
    enabledAt: string;
    expiresAt: string | null;
    reason: string;
    grantedBy: { firstName: string; lastName: string };
  } | null;
}

export const developerApi = {
  list: (search?: string) => api.get<DeveloperCandidate[]>('/admin/developer-access', { params: { search: search || undefined } }).then((r) => r.data),
  enable: (userId: string, reason: string, expiresAt?: string) => api.post('/admin/developer-access/enable', { userId, reason, expiresAt }),
  disable: (userId: string, reason: string) => api.post(`/admin/developer-access/${userId}/disable`, { reason }),
};
