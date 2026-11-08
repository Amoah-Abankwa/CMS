import { isAxiosError } from 'axios';
import { AppProblem } from './appProblem';
import { fieldErrors } from './fieldErrors';

export { AppProblem };

export { fieldErrors };

/**
 * Every failure, said the same way: what went wrong, whose fault it is, and how to fix it. Screens show
 * this instead of raw error text.
 */
export type ErrorKind = 'offline' | 'slow' | 'server' | 'permission' | 'missing' | 'validation' | 'busy' | 'auth' | 'unknown';
export interface Described { kind: ErrorKind; what: string; whose: string; fix: string; retry: boolean; reference?: string; fields: Record<string, string> }

type Body = { code?: string; message?: string; details?: string[]; correlationId?: string };



export function describeError(err: unknown, online = true): Described {
  const fields: Record<string, string> = {};
  if (err instanceof AppProblem) return err.toDescribed();
  if (!isAxiosError(err)) return { fields, kind: 'unknown', what: 'Something unexpected happened in the app.', whose: 'A problem in the app, not something you did.', fix: 'Close the screen and open it again. If it keeps happening, tell ICT support.', retry: true };
  const body = (err.response?.data ?? {}) as Body;
  const reference = body.correlationId;
  if (!err.response) {
    if (!online) return { fields, kind: 'offline', what: 'You are offline.', whose: 'Your phone has no internet connection right now.', fix: 'Connect to Wi-Fi or mobile data. Screens you have opened before still show their last copy.', retry: true };
    if (err.code === 'ECONNABORTED') return { fields, kind: 'slow', what: 'This took too long to load.', whose: 'The connection is slow or unstable; nothing is wrong with your account.', fix: 'Try again, or turn on Lite mode in More to load less.', retry: true };
    return { fields, kind: 'server', what: 'We could not reach ANU.', whose: 'Either the network is blocking it or our server is down; not something you did.', fix: 'Try again in a minute. If it lasts, check another app works, then tell ICT support.', retry: true };
  }
  const s = err.response.status;
  const message = body.message ?? '';
  if (s === 401) return { fields, kind: 'auth', what: message || 'You need to sign in again.', whose: 'Your sign-in has ended.', fix: 'Sign in again; anything you were writing has been kept.', retry: false };
  if (s === 403) return { fields, kind: 'permission', what: message || 'You do not have access to this.', whose: 'Your role does not include this part of the platform.', fix: 'Go back, or ask the office that manages it to give you access.', retry: false };
  if (s === 404) return { fields, kind: 'missing', what: message || 'We could not find that.', whose: 'It may have been removed, or the link is out of date.', fix: 'Go back and refresh the list.', retry: false };
  if (s === 429) return { fields, kind: 'busy', what: 'Too many tries in a short time.', whose: 'A safety limit that protects your account.', fix: 'Wait a minute, then try again.', retry: true };
  if (s >= 500) return { fields, kind: 'server', reference, what: 'Something went wrong on our side.', whose: 'A problem with the ANU servers, not with anything you did.', fix: `Try again in a few minutes.${reference ? ` If it keeps happening, give ICT support this code: ${reference.slice(0, 8)}.` : ''}`, retry: true };
  // 400-level: the request itself needs changing. The server's message says what and how.
  return { kind: 'validation', what: message || 'Something needs changing before this can be saved.', whose: 'A detail in what was entered.', fix: 'Check the highlighted fields.', retry: false, fields: fieldErrors(body.details) };
}


/** The phone is offline and there is no saved copy to show. */
export function offlineError(): Described {
  return { fields: {}, kind: 'offline', what: 'You are offline.', whose: 'Your phone has no internet connection right now.', fix: 'Connect to Wi-Fi or mobile data, then pull down to refresh. This screen has not been saved on the phone yet.', retry: true };
}
