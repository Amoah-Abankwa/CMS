import { isAxiosError } from 'axios';
import { AppProblem } from '@/lib/errors';
import { create } from 'zustand';
import { axiosInstance } from '@/lib/api';
import { tokenStore } from '@/lib/tokens';
import { useCache } from './cache';

export interface Me {
  id: string;
  type: 'STUDENT' | 'STAFF' | 'PARTNER';
  firstName: string;
  lastName: string;
  email: string | null;
  indexNumber: string | null;
  mustChangePassword: boolean;
  activeRoleKey: string | null;
  roles: Array<{ key: string; name: string }>;
  permissions: string[];
  studentProfile: { admissionYear: number; currentLevel: number; programme: { code: string; name: string } } | null;
  staffProfile: { staffNumber: string; title: string | null; department: { name: string } | null } | null;
}

type Status = 'unknown' | 'signed_in' | 'signed_out';

interface AuthState {
  status: Status;
  me: Me | null;
  /** Why the person is on the sign-in screen, if not by choice (shown there). */
  signedOutReason: 'expired' | null;
  hydrate: () => Promise<void>;
  completeSignIn: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  signOut: (reason?: 'expired') => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'unknown',
  me: null,
  signedOutReason: null,
  /** On launch: signed in if a stored token still works (refreshing it if needed). */
  async hydrate() {
    const { accessToken, refreshToken } = await tokenStore.get();
    if (!accessToken && !refreshToken) return set({ status: 'signed_out' });
    try {
      const me = (await axiosInstance.get<Me>('/auth/me')).data;
      set({ status: 'signed_in', me });
    } catch (e) {
      // No answer at all (offline): stay signed in and show the saved screens.
      if (isAxiosError(e) && !e.response && refreshToken) return set({ status: 'signed_in' });
      // The server answered no (the sign-in has expired): start again.
      await tokenStore.clear();
      set({ status: 'signed_out', signedOutReason: isAxiosError(e) && e.response?.status === 401 ? 'expired' : null });
    }
  },
  async completeSignIn(tokens) {
    // The server sends the app its tokens only when it knows the request is from the app. An older
    // server answers the website's way (a cookie, no tokens): say so plainly instead of failing.
    const ok = (v: unknown) => typeof v === 'string' && v.length > 0;
    if (!tokens || !ok(tokens.accessToken) || !ok(tokens.refreshToken)) {
      throw new AppProblem({
        kind: 'server',
        what: 'The server signed you in for the website, not for the app.',
        whose: 'The university server needs updating; nothing you did.',
        fix: 'Ask ICT support to update and restart the server, then sign in again. You can sign in on the website meanwhile.',
        retry: false,
      });
    }
    await tokenStore.set(tokens.accessToken, tokens.refreshToken);
    const me = (await axiosInstance.get<Me>('/auth/me')).data;
    set({ status: 'signed_in', me, signedOutReason: null });
  },
  async signOut(reason) {
    if (!reason) await axiosInstance.post('/auth/logout').catch(() => undefined);
    await tokenStore.clear();
    // Saved screens belong to this person; drafts are kept so they can carry on after signing in.
    useCache.getState().clear();
    set({ status: 'signed_out', me: null, signedOutReason: reason ?? null });
  },
}));
