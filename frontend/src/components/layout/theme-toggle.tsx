'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api';
import type { ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'LIGHT', label: 'Light theme', Icon: Sun },
  { value: 'DARK', label: 'Dark theme', Icon: Moon },
  { value: 'SYSTEM', label: 'Match device theme', Icon: Monitor },
];

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const signedIn = useAuthStore((s) => s.status === 'authenticated');

  const choose = (value: ThemePreference) => {
    setTheme(value);
    // Saved to the profile so it follows the user to other devices. The local choice already applies.
    if (signedIn) authApi.updatePreferences({ theme: value }).catch(() => undefined);
  };

  return (
    <div role="group" aria-label="Theme" className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          className={cn('grid size-8 place-items-center rounded text-muted hover:text-text', theme === value && 'bg-surface-muted text-text')}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
