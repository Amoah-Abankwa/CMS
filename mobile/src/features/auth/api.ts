import { axiosInstance } from '@/lib/api';

type Tokens = { accessToken: string; refreshToken: string };
export type StaffStep = { status: 'mfa_required' | 'mfa_enrolment_required'; challengeToken: string };

export const authApi = {
  student: (indexNumber: string, password: string) => axiosInstance.post<Tokens & { status: 'signed_in'; mustChangePassword: boolean }>('/auth/student/login', { indexNumber: indexNumber.trim().toUpperCase(), password }).then((r) => r.data),
  staff: (email: string, password: string) => axiosInstance.post<StaffStep>('/auth/staff/login', { email: email.trim().toLowerCase(), password }).then((r) => r.data),
  verify: (challengeToken: string, code: string) => axiosInstance.post<Tokens>('/auth/mfa/verify', { challengeToken, code: code.trim() }).then((r) => r.data),
  sendEmailCode: (challengeToken: string) => axiosInstance.post<{ sentTo: string }>('/auth/mfa/email/send', { challengeToken }).then((r) => r.data),
  verifyEmailCode: (challengeToken: string, code: string) => axiosInstance.post<StaffStep>('/auth/mfa/email/verify', { challengeToken, code: code.trim() }).then((r) => r.data),
  startEnrol: (challengeToken: string) => axiosInstance.post<{ otpauthUrl: string; manualKey: string }>('/auth/mfa/enrol/start', { challengeToken }).then((r) => r.data),
  confirmEnrol: (challengeToken: string, code: string) => axiosInstance.post<Tokens & { recoveryCodes: string[] }>('/auth/mfa/enrol/confirm', { challengeToken, code: code.trim() }).then((r) => r.data),
};
