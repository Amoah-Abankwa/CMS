'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import type { Semester } from '@/features/academics/api';
import { resultsApi, SHEET_STATUS, type Sheet } from '../api';

const TABS = [
  { value: 'ACTION', label: 'Needs my action' },
  { value: '', label: 'All submitted' },
  { value: 'PUBLISHED', label: 'Published' },
];

export function SheetsList() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [tab, setTab] = useState('ACTION');
  const [data, setData] = useState<{ semester: Semester; items: Sheet[]; actionableStages: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    resultsApi.sheets({ semesterId: semesterId || undefined, status: tab || undefined }).then(setData).catch((err) => setError(errorMessage(err)));
  }, [semesterId, tab]);

  const viewOnly = data && data.actionableStages.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {semesters && (
        <div className="max-w-sm">
          <SemesterSelect semesters={semesters} value={semesterId} onChangeAction={setSemesterId} />
        </div>
      )}
      <div role="tablist" aria-label="Results" className="flex gap-1 border-b border-border">
        {TABS.filter((t) => !(viewOnly && t.value === 'ACTION')).map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', tab === t.value ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-text')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {viewOnly && tab === 'ACTION' && <Alert tone="info">Your role can view results but does not approve them. Showing all submitted results.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState title={tab === 'ACTION' ? 'Nothing waiting for you' : 'No results here yet'} description="Results appear here once lecturers submit them." />
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {data.items.map((s) => (
            <li key={s.id}>
              <Link href={`/academics/results/${s.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    <span className="font-mono">{s.offering.course.code}</span> {s.offering.course.title}
                  </span>
                  <span className="block text-xs text-muted">
                    {s.offering.course.department.name}. {s.offering.lecturers.map((l) => l.name).join(', ')}. {s.summary.students} students
                    {s.summary.passRate !== null ? `, ${s.summary.passRate}% pass` : ''}.
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {s.canAct && <Badge tone="primary">Your turn</Badge>}
                  <Badge tone={SHEET_STATUS[s.status].tone}>{SHEET_STATUS[s.status].label}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
