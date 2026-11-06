'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { registrationApi, type MyCourse, type TrailingCourse } from '../api';

interface Drop { id: string; reason: string; status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'; decisionNote: string | null; createdAt: string; offering: { id: string; course: { code: string; title: string } } }
const DROP: Record<Drop['status'], { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = { REQUESTED: { label: 'Drop requested', tone: 'warning' }, APPROVED: { label: 'Dropped', tone: 'success' }, REJECTED: { label: 'Drop not approved', tone: 'danger' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' } };

const STATUS: Record<MyCourse['status'], { label: string; tone: 'success' | 'danger' | 'warning' | 'primary' }> = {
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  INCOMPLETE: { label: 'Incomplete', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'primary' },
};
type Filter = 'ALL' | 'PASSED' | 'FAILED' | 'TRAILING' | 'CURRENT';

/**
 * The student's registered courses (once their registration is approved): passed in green, failed in
 * red, with filters, and their trailing courses (failed and not yet passed) listed apart.
 */
export function MyCourses() {
  const [data, setData] = useState<{ courses: MyCourse[]; trailing: TrailingCourse[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = () => { registrationApi.courses().then(setData).catch((err) => setError(errorMessage(err))); api.get<Drop[]>('/me/drops').then((r) => setDrops(r.data)).catch(() => undefined); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const askDrop = (r: MyCourse) => {
    const reason = window.prompt(`Why do you want to drop ${r.course.code} ${r.course.title}?`);
    if (!reason || reason.trim().length < 5) return;
    api.post('/me/drops', { offeringId: r.offeringId, reason: reason.trim() }).then(() => { setMsg({ tone: 'success', text: `Request to drop ${r.course.code} sent for approval.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  };
  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const { courses, trailing } = data;
  const count = (f: Filter) => (f === 'TRAILING' ? trailing.length : courses.filter((r) => match(r, f)).length);
  const passedCredits = courses.filter((r) => r.status === 'PASSED').reduce((t, r) => t + r.course.creditHours, 0);
  const shown = courses.filter((r) => match(r, filter));
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {trailing.length > 0 && filter !== 'TRAILING' && <TrailingList trailing={trailing} />}
      {drops.length > 0 && (
        <Card>
          <CardHeader title="Drop requests" />
          <ul className="divide-y divide-border">
            {drops.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span><span className="font-mono">{d.offering.course.code}</span> {d.offering.course.title}<span className="block text-xs text-muted">Asked {formatDate(d.createdAt)}: {d.reason}{d.decisionNote ? `. Reply: ${d.decisionNote}` : ''}</span></span>
                <span className="flex items-center gap-2"><Badge tone={DROP[d.status].tone}>{DROP[d.status].label}</Badge>{d.status === 'REQUESTED' && <Button size="sm" variant="ghost" onClick={() => api.post(`/me/drops/${d.id}/withdraw`).then(load)}>Withdraw</Button>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
        {(['ALL', 'PASSED', 'FAILED', 'TRAILING', 'CURRENT'] as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('rounded-md border px-3 py-1.5 text-sm', filter === f ? 'border-primary bg-primary text-white' : 'border-border hover:bg-surface-muted')}>
            {{ ALL: 'All', PASSED: 'Passed', FAILED: 'Failed', TRAILING: 'Trailing', CURRENT: 'This term' }[f]} ({count(f)})
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{passedCredits} credits passed. {trailing.length ? `${trailing.length} trailing course${trailing.length === 1 ? '' : 's'} to pass.` : 'No trailing courses.'} Courses appear here once your registration is approved.</p>
      {filter === 'TRAILING' ? (trailing.length ? <TrailingList trailing={trailing} /> : <EmptyState title="No trailing courses" />) : shown.length === 0 ? <EmptyState title="Nothing here" description={filter === 'ALL' ? 'Your courses appear here once your registration is approved.' : undefined} /> : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.offeringId} className={cn('flex flex-col gap-1 border-l-4 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5', r.status === 'PASSED' ? 'border-l-success' : r.status === 'FAILED' ? 'border-l-danger' : 'border-l-transparent')}>
                <span><span className="font-mono font-medium">{r.course.code}</span> {r.course.title}<span className="block text-xs text-muted">{r.term}, {r.course.creditHours} credits</span></span>
                <span className="flex items-center gap-2">{r.grade && <span className="tabular-nums">{r.grade}{r.total !== null ? ` (${r.total})` : ''}</span>}<Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>{r.current && r.status === 'IN_PROGRESS' && !drops.some((d) => d.offering.id === r.offeringId && d.status === 'REQUESTED') && <Button size="sm" variant="ghost" onClick={() => askDrop(r)}>Ask to drop</Button>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TrailingList({ trailing }: { trailing: TrailingCourse[] }) {
  return (
    <Card className="border-danger">
      <CardHeader title={`Trailing courses (${trailing.length})`} description="Courses you failed and have not yet passed. Register them again to clear them; a pass removes them from this list." />
      <ul className="divide-y divide-border">
        {trailing.map((t) => (
          <li key={t.course.id} className="flex flex-col gap-1 border-l-4 border-l-danger px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span><span className="font-mono font-medium">{t.course.code}</span> {t.course.title}<span className="block text-xs text-muted">Last taken {t.term}, {t.course.creditHours} credits</span></span>
            <span className="flex items-center gap-2">{t.grade && <span className="tabular-nums">{t.grade}{t.total !== null ? ` (${t.total})` : ''}</span>}{t.registeredThisTerm ? <Badge tone="primary">Registered this term</Badge> : <Badge tone="danger">Trailing</Badge>}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function match(r: MyCourse, f: Filter) {
  if (f === 'ALL') return true;
  if (f === 'PASSED') return r.status === 'PASSED';
  if (f === 'FAILED') return r.status === 'FAILED';
  if (f === 'CURRENT') return r.current;
  return false;
}
