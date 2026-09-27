import { api } from '@/lib/axios';
import type { Me } from '@/stores/auth.store';
import type { ThemePreference } from '@/lib/theme';

export interface SignedIn {
  status: 'signed_in';
  mustChangePassword: boolean;
  usedRecoveryCode?: boolean;
  recoveryCodes?: string[];
}

export interface StaffPasswordResult {
  status: 'mfa_required' | 'mfa_enrolment_required';
  challengeToken: string;
}

export interface Enrolment {
  otpauthUrl: string;
  qrDataUrl: string;
  manualKey: string;
}

export interface ActiveSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface SetupInfo {
  firstName: string;
  type: 'STUDENT' | 'STAFF' | 'PARTNER';
  signInWith: string;
}

export const authApi = {
  verifySetup: (token: string) => api.post<SetupInfo>('/auth/setup/verify', { token }).then((r) => r.data),
  completeSetup: (token: string, password: string) =>
    api.post<{ type: SetupInfo['type']; signInWith: string }>('/auth/setup/complete', { token, password }).then((r) => r.data),
  studentLogin: (indexNumber: string, password: string) =>
    api.post<SignedIn>('/auth/student/login', { indexNumber, password }).then((r) => r.data),
  staffLogin: (email: string, password: string) =>
    api.post<StaffPasswordResult>('/auth/staff/login', { email, password }).then((r) => r.data),
  verifyMfa: (challengeToken: string, code: string) =>
    api.post<SignedIn>('/auth/mfa/verify', { challengeToken, code }).then((r) => r.data),
  startEnrolment: (challengeToken: string) =>
    api.post<Enrolment>('/auth/mfa/enrol/start', { challengeToken }).then((r) => r.data),
  confirmEnrolment: (challengeToken: string, code: string) =>
    api.post<SignedIn>('/auth/mfa/enrol/confirm', { challengeToken, code }).then((r) => r.data),
  me: () => api.get<Me>('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  switchRole: (roleKey: string) => api.post('/auth/switch-role', { roleKey }),
  stepUp: (code: string) => api.post('/auth/mfa/step-up', { code }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/password/change', { currentPassword, newPassword }),
  forgotPassword: (identifier: string) =>
    api.post<{ message: string }>('/auth/password/forgot', { identifier }).then((r) => r.data),
  resetPassword: (identifier: string, code: string, newPassword: string) =>
    api.post('/auth/password/reset', { identifier, code, newPassword }),
  sessions: () => api.get<ActiveSession[]>('/auth/sessions').then((r) => r.data),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
  updatePreferences: (prefs: Partial<{ theme: ThemePreference; sidebarCollapsed: boolean }>) =>
    api.patch('/me/preferences', prefs),
};
