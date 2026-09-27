'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { developerApi, type DeveloperCandidate } from '../api';
import { DeveloperAccessDialog } from './developer-access-dialog';

export function DeveloperAccessList() {
  const myId = useAuthStore((s) => s.me?.id);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<DeveloperCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'enable' | 'disable'; person: DeveloperCandidate } | null>(null);

  const load = useCallback(() => {
    developerApi.list(search.trim()).then(setRows).catch((err) => setError(errorMessage(err)));
  }, [search]);

  useEffect(() => {
    const id = window.setTimeout(load, 300);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <label htmlFor="dev-search" className="sr-only">
          Search staff
        </label>
        <Input id="dev-search" type="search" placeholder="Search staff by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <EmptyState title="No staff match your search" />}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {p.firstName} {p.lastName}
                  {p.activeGrant ? <Badge tone="warning">Developer access on</Badge> : <Badge>Off</Badge>}
                </p>
                <p className="truncate text-xs text-muted">{p.email}</p>
                {p.activeGrant && (
                  <p className="mt-1 text-xs text-muted">
                    Enabled {formatDateTime(p.activeGrant.enabledAt)} by {p.activeGrant.grantedBy.firstName} {p.activeGrant.grantedBy.lastName}.{' '}
                    {p.activeGrant.expiresAt ? `Expires ${formatDateTime(p.activeGrant.expiresAt)}.` : 'No expiry.'}
                  </p>
                )}
              </div>
              {p.id === myId ? (
                <p className="text-xs text-muted">Another Super Admin must change your own access.</p>
              ) : p.activeGrant ? (
                <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: 'disable', person: p })}>
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={() => setDialog({ mode: 'enable', person: p })}>
                  Enable
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <DeveloperAccessDialog
        mode={dialog?.mode ?? 'enable'}
        person={dialog?.person ?? null}
        onClose={() => setDialog(null)}
        onDone={() => {
          setNotice(dialog?.mode === 'enable' ? 'Developer access enabled.' : 'Developer access disabled.');
          setDialog(null);
          load();
        }}
      />
    </div>
  );
}
