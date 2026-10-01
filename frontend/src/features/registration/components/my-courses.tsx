'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { registrationApi, type MyCourse } from '../api';

const STATUS: Record<MyCourse['status'], { label: string; tone: 'success' | 'danger' | 'warning' | 'primary' | 'neutral' }> = {
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  INCOMPLETE: { label: 'Incomplete', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'primary' },
  AWAITING_APPROVAL: { label: 'Waiting for approval', tone: 'neutral' },
};
type Filter = 'ALL' | 'PASSED' | 'FAILED' | 'CURRENT';

/** Every course the student has registered for: passed in green, failed in red, with filters. */
export function MyCourses() {
  const [rows, setRows] = useState<MyCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  useEffect(() => { registrationApi.courses().then(setRows).catch((err) => setError(errorMessage(err))); }, []);
  if (!rows) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const count = (f: Filter) => rows.filter((r) => match(r, f)).length;
  const shown = rows.filter((r) => match(r, filter));
  const credits = (f: Filter) => rows.filter((r) => match(r, f)).reduce((t, r) => t + r.course.creditHours, 0);
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
        {(['ALL', 'PASSED', 'FAILED', 'CURRENT'] as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-md border px-3 py-1.5 text-sm', filter === f ? 'border-primary bg-primary text-white' : 'border-border hover:bg-surface-muted')}>
            {{ ALL: 'All', PASSED: 'Passed', FAILED: 'Failed', CURRENT: 'This term' }[f]} ({count(f)})
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{credits('PASSED')} credits passed{count('FAILED') ? `, ${count('FAILED')} failed courses to retake` : ''}.</p>
      {shown.length === 0 ? <EmptyState title="Nothing here" /> : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.offeringId} className={cn('flex flex-col gap-1 border-l-4 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5', r.status === 'PASSED' ? 'border-l-success' : r.status === 'FAILED' ? 'border-l-danger' : 'border-l-transparent')}>
                <span><span className="font-mono font-medium">{r.course.code}</span> {r.course.title}<span className="block text-xs text-muted">{r.term}, {r.course.creditHours} credits</span></span>
                <span className="flex items-center gap-2">{r.grade && <span className="tabular-nums">{r.grade}{r.total !== null ? ` (${r.total})` : ''}</span>}<Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function match(r: MyCourse, f: Filter) {
  if (f === 'ALL') return true;
  if (f === 'PASSED') return r.status === 'PASSED';
  if (f === 'FAILED') return r.status === 'FAILED';
  return r.status === 'IN_PROGRESS' || r.status === 'AWAITING_APPROVAL';
}
