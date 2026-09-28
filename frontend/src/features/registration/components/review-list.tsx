'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { registrationApi, type RegistrationStatus, type ReviewItem, type ReviewPage } from '../api';
import { ReviewDialog } from './review-dialog';

const TABS: Array<{ status: RegistrationStatus; label: string }> = [
  { status: 'SUBMITTED', label: 'Waiting' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Returned' },
];
const PAGE_SIZE = 25;

export function ReviewList() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [status, setStatus] = useState<RegistrationStatus>('SUBMITTED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReviewPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<ReviewItem | null>(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(() => {
    setError(null);
    return registrationApi
      .review({ semesterId: semesterId || undefined, status, search: search.trim() || undefined, page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [semesterId, status, search, page, reload]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {semesters && <SemesterSelect semesters={semesters} value={semesterId} onChange={(v) => { setSemesterId(v); setPage(1); }} />}
        <div>
          <label htmlFor="rev-search" className="sr-only">
            Search students
          </label>
          <Input id="rev-search" type="search" placeholder="Search by name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div role="tablist" aria-label="Registration status" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.status}
            role="tab"
            type="button"
            aria-selected={status === t.status}
            onClick={() => { setStatus(t.status); setPage(1); }}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', status === t.status ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-text')}
          >
            {t.label}
            <span className="ml-1.5 tabular-nums text-muted">{data?.counts[t.status] ?? 0}</span>
          </button>
        ))}
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && (
        <EmptyState title={status === 'SUBMITTED' ? 'Nothing waiting for review' : 'No registrations here yet'} description={status === 'SUBMITTED' ? 'New submissions from students in your department appear here.' : undefined} />
      )}
      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{fullName(r.student)}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{r.student.indexNumber}</span>, {r.student.studentProfile?.programme.name}, level {r.student.studentProfile?.currentLevel}.{' '}
                    {r.courses.length} courses, {r.credits} credits.
                    {r.submittedAt ? ` Submitted ${formatDateTime(r.submittedAt)}.` : ''}
                  </p>
                </div>
                <span className="flex gap-2">
                  {status === 'APPROVED' && <Button variant="ghost" size="sm" onClick={() => { const reason = window.prompt(`Reopen ${fullName(r.student)}'s registration so they can change it and submit again. Reason:`); if (reason && reason.trim().length >= 5) registrationApi.reopen(r.id, reason.trim()).then(() => { window.alert(`Reopened. ${fullName(r.student)} can change the registration and submit it again.`); setReload((n) => n + 1); }).catch((err) => window.alert(errorMessage(err))); }}>Reopen</Button>}
                  <Button variant={status === 'SUBMITTED' ? 'primary' : 'secondary'} size="sm" onClick={() => setOpen(r)}>
                    {status === 'SUBMITTED' ? 'Review' : 'View'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}

      <ReviewDialog
        item={open}
        onClose={() => setOpen(null)}
        onDecided={(message) => {
          setOpen(null);
          setNotice(message);
          void load();
        }}
      />
    </div>
  );
}
