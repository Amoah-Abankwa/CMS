import { isAxiosError } from 'axios';
import { axiosInstance } from './api';

/**
 * The website's API modules (ported into src/api) import `api` and `errorMessage` from here, so they run
 * unchanged on the app's axios instance (tokens, refresh, the mobile client header).
 */
export const api = axiosInstance;

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isAxiosError(err)) return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  return isAxiosError(err) ? (err.response?.data as { code?: string } | undefined)?.code : undefined;
}
