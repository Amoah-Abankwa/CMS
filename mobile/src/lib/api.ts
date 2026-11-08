import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { tokenStore } from './tokens';

/**
 * The one axios instance the app uses. It marks every request as coming from the app (so the backend
 * returns tokens instead of cookies and lets the request past its cross-site check), adds the access
 * token, and when that has expired, refreshes it once and retries. If refreshing fails, the session has
 * really expired: `onSessionExpired` runs (it saves the person's work, then signs them out).
 */
export const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'x-anu-client': 'mobile', Accept: 'application/json' },
});

let onSessionExpired: (() => Promise<void>) | null = null;
export function setSessionExpiredHandler(fn: () => Promise<void>) {
  onSessionExpired = fn;
}

axiosInstance.interceptors.request.use(async (config) => {
  const { accessToken } = await tokenStore.get();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** One refresh at a time: requests that fail together wait for the same refresh. */
let refreshing: Promise<boolean> | null = null;
async function refreshTokens() {
  refreshing ??= (async () => {
    try {
      const { refreshToken } = await tokenStore.get();
      if (!refreshToken) return false;
      const r = await axios.post<{ accessToken: string; refreshToken: string }>(`${API_URL}/auth/refresh`, { refreshToken }, { headers: { 'x-anu-client': 'mobile' }, timeout: 15_000 });
      await tokenStore.set(r.data.accessToken, r.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };
const NO_REFRESH = ['/auth/student/login', '/auth/staff/login', '/auth/mfa/', '/auth/refresh', '/auth/password/'];

axiosInstance.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as Retriable | undefined;
    const isAuthCall = NO_REFRESH.some((p) => config?.url?.startsWith(p));
    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      if (await refreshTokens()) return axiosInstance(config);
      await onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);
