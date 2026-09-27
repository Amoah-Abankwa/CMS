'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, loginPathForLastUser } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { Spinner } from '@/components/ui/states';
import { authApi } from '../api';

const PASSWORD_PAGE = '/account/password';

/** Loads the signed-in user once, applies their saved preferences and enforces password change. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const markSignedOut = useAuthStore((s) => s.markSignedOut);
  const setTheme = useUiStore((s) => s.setTheme);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'unknown') return;
    authApi
      .me()
      .then((data) => {
        setMe(data);
        setTheme(data.preference.theme);
        setCollapsed(data.preference.sidebarCollapsed);
      })
      .catch(() => markSignedOut());
  }, [status, setMe, markSignedOut, setTheme, setCollapsed]);

  useEffect(() => {
    if (status === 'signed_out') router.replace(loginPathForLastUser());
  }, [status, router]);

  useEffect(() => {
    if (me?.mustChangePassword && pathname !== PASSWORD_PAGE) router.replace(PASSWORD_PAGE);
  }, [me, pathname, router]);

  if (status !== 'authenticated' || !me) return <Spinner label="Checking your session" />;
  if (me.mustChangePassword && pathname !== PASSWORD_PAGE) return <Spinner />;
  return <>{children}</>;
}
