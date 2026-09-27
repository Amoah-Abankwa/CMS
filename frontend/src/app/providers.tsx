'use client';

import { useEffect, type ReactNode } from 'react';
import { useUiStore } from '@/stores/ui.store';
import { applyTheme } from '@/lib/theme';

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useUiStore((s) => s.hydrate);
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Follow the device setting live while the preference is "System".
  useEffect(() => {
    if (theme !== 'SYSTEM') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('SYSTEM');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return <>{children}</>;
}
