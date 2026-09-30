'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import type { Semester } from '../api';
import { useSemesters } from '../use-semesters';
import { RegistrationWindow } from './registration-window';
import { SemesterDialog } from './semester-dialog';

export function SemestersTable({ reloadKey = 0, onChangedAction }: { reloadKey?: number; onChangedAction?: () => void } = {}) {
  const { semesters, error, reload } = useSemesters();
  // Reload when a year or semester is added above.
  useEffect(() => { if (reloadKey) reload(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState<Semester | null>(null);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!semesters) return <Spinner />;

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {semesters.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {s.label}
                {s.isCurrent && <Badge tone="primary">Current</Badge>}
              </p>
              <p className="text-xs text-muted">
                {formatDate(s.startDate)} to {formatDate(s.endDate)}. Credits per student: {s.minCredits} to {s.maxCredits}.
              </p>
              <div className="mt-1.5">
                <RegistrationWindow semester={s} />
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <SemesterDialog
        semester={editing}
        onCloseAction={() => setEditing(null)}
        onSavedAction={() => {
          setEditing(null);
          void reload(); onChangedAction?.();
        }}
      />
    </>
  );
}
