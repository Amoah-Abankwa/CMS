import { create } from 'zustand';
import type { ThemePreference } from '@/lib/theme';

export interface RoleSummary {
  key: string;
  name: string;
  logGroup: string;
}

export interface Me {
  id: string;
  photoUrl?: string | null;
  type: 'STUDENT' | 'STAFF' | 'PARTNER';
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  indexNumber: string | null;
  mustChangePassword: boolean;
  primaryRoleKey: string | null;
  activeRoleKey: string | null;
  roles: RoleSummary[];
  permissions: string[];
  preference: { theme: ThemePreference; sidebarCollapsed: boolean };
  studentProfile: { admissionYear: number; currentLevel: number; programme: { code: string; name: string } } | null;
  staffProfile: { staffNumber: string; title: string | null; department: { name: string } | null } | null;
}

type Status = 'unknown' | 'authenticated' | 'signed_out';

interface AuthState {
  status: Status;
  me: Me | null;
  setMe: (me: Me) => void;
  markSignedOut: () => void;
  can: (permission: string) => boolean;
}

export const LOGIN_KIND_KEY = 'anu-login-kind';

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  me: null,
  setMe: (me) => {
    try {
      localStorage.setItem(LOGIN_KIND_KEY, me.type === 'STUDENT' ? 'student' : 'staff');
    } catch {
      /* storage unavailable */
    }
    set({ me, status: 'authenticated' });
  },
  markSignedOut: () => set({ me: null, status: 'signed_out' }),
  can: (permission) => !!get().me?.permissions.includes(permission),
}));

/** Where to send someone whose session ended, based on how they last signed in. */
export function loginPathForLastUser(): string {
  try {
    return localStorage.getItem(LOGIN_KIND_KEY) === 'staff' ? '/staff/login' : '/login';
  } catch {
    return '/login';
  }
}
