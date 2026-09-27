'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { describeDevice, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/axios';
import { authApi, type ActiveSession } from '../api';

export function SessionsList() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    authApi.sessions().then(setSessions).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await authApi.revokeSession(id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!sessions) return <Spinner />;

  return (
    <ul className="divide-y divide-border">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              {describeDevice(s.userAgent)}
              {s.current && <Badge tone="success">This device</Badge>}
            </p>
            <p className="text-xs text-muted">
              {s.ipAddress ?? 'Unknown IP'}, last active {formatDateTime(s.lastSeenAt)}
            </p>
          </div>
          {!s.current && (
            <Button variant="secondary" size="sm" loading={busyId === s.id} onClick={() => revoke(s.id)}>
              Sign out
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
