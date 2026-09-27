'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { authApi } from './api';

/** After any successful sign-in: load the profile, apply saved preferences, route onward. */
export function useCompleteSignIn() {
  const router = useRouter();
  const setMe = useAuthStore((s) => s.setMe);
  const setTheme = useUiStore((s) => s.setTheme);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  return async () => {
    const me = await authApi.me();
    setMe(me);
    setTheme(me.preference.theme);
    setCollapsed(me.preference.sidebarCollapsed);
    router.replace(me.mustChangePassword ? '/account/password' : '/dashboard');
  };
}
