'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api';
import { errorMessage } from '@/lib/axios';

export function RoleSwitcher() {
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  const active = me.roles.find((r) => r.key === me.activeRoleKey);
  if (me.roles.length <= 1) {
    return <span className="inline-flex rounded bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{active?.name ?? 'No role'}</span>;
  }

  const onChange = async (roleKey: string) => {
    setBusy(true);
    setError(null);
    try {
      await authApi.switchRole(roleKey);
      setMe(await authApi.me());
      router.push('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label htmlFor="active-role" className="sr-only">
        Active role
      </label>
      <select
        id="active-role"
        value={me.activeRoleKey ?? ''}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text"
      >
        {me.roles.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
