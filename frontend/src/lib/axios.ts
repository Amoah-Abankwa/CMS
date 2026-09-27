import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { useStepUpStore } from '@/stores/step-up.store';

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; _steppedUp?: boolean };

/** The single HTTP client for the web app. Feature api.ts files are the only callers. */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'x-anu-client': 'web' },
  timeout: 30_000,
});

const NO_REFRESH = ['/auth/student/login', '/auth/staff/login', '/auth/mfa/verify', '/auth/mfa/enrol', '/auth/refresh', '/auth/password/', '/auth/setup/'];
const REFRESHABLE_CODES = new Set(['TOKEN_EXPIRED', 'AUTH_REQUIRED']);

let refreshing: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  // Concurrent 401s share one refresh request.
  refreshing ??= api
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (!config) throw error;

    const skip = NO_REFRESH.some((p) => config.url?.startsWith(p));
    if (status === 401 && !skip && !config._retried && code && REFRESHABLE_CODES.has(code)) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        useAuthStore.getState().markSignedOut();
        throw error;
      }
    }

    if (status === 401 && !skip) {
      useAuthStore.getState().markSignedOut();
    }

    if (status === 403 && code === 'STEP_UP_REQUIRED' && !config._steppedUp) {
      config._steppedUp = true;
      const confirmed = await useStepUpStore.getState().request();
      if (confirmed) return api(config);
    }

    throw error;
  },
);

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError<ApiError>(err)) {
    if (!err.response) return 'Cannot reach the server. Check your connection and try again.';
    return err.response.data?.message ?? fallback;
  }
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  return axios.isAxiosError<ApiError>(err) ? err.response?.data?.code : undefined;
}
