'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { examsApi, type EligibilityPaper, type EligibilityView } from '../api';
import { OverrideDialog } from './override-dialog';

const FILTERS = [
  { value: 'NOT_ELIGIBLE', label: 'Not eligible' },
  { value: 'UNPUBLISHED', label: 'Not yet published' },
  { value: 'ELIGIBLE', label: 'Fully eligible' },
  { value: '', label: 'Everyone' },
];
const PAGE_SIZE = 25;

export function EligibilityManager() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [filter, setFilter] = useState('NOT_ELIGIBLE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<EligibilityView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'generate' | 'publish' | 'policy' | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [overriding, setOverriding] = useState<{ paper: EligibilityPaper; student: string } | null>(null);

  const load = useCallback(
    () =>
      examsApi
        .eligibility({ semesterId: semesterId || undefined, filter: filter || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE })
        .then(setView)
        .catch((err) => setError(errorMessage(err))),
    [semesterId, filter, search, page],
  );

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const run = async (kind: 'generate' | 'publish' | 'policy', fn: () => Promise<string>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirmPublish(false);
    }
  };

  if (error && !view) return <Alert tone="danger">{error}</Alert>;
  if (!view) return <Spinner />;
  const generated = !!view.meta.generatedAt;

  return (
    <div className="flex flex-col gap-4">
      {semesters && (
        <div className="max-w-sm">
          <SemesterSelect semesters={semesters} value={semesterId} onChangeAction={(v) => { setSemesterId(v); setPage(1); }} />
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm font-medium">Rules for {view.semester.label}</p>
        {(
          [
            ['requireFinancialClearance', 'Students must be cleared by the Finance Office', 'Cleared on the Fee clearance page.'],
            ['requireMinimumAttendance', 'Students must meet the class attendance minimum', 'The minimum is set under Attendance rules. Courses with no recorded classes are not checked.'],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={view.policy[key]}
              disabled={busy === 'policy'}
              onChange={(e) => {
                const next = { ...view.policy, [key]: e.target.checked };
                void run('policy', async () => {
                  await examsApi.setPolicy(next);
                  return 'Rules saved. Recalculate the list to apply them.';
                });
              }}
            />
            <span>
              {label}
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">Active holds always block the papers they cover.</p>
        <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {generated ? `Generated ${formatDateTime(view.meta.generatedAt!)}.` : 'Not generated yet.'}{' '}
            {view.meta.publishedAt ? `Published ${formatDateTime(view.meta.publishedAt)}.` : 'Not published yet.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === 'generate'}
              onClick={() => run('generate', async () => { await examsApi.generate(view.semester.id); return 'Eligibility recalculated from fee clearance, attendance and holds. Overrides were kept.'; })}
            >
              {generated ? 'Recalculate' : 'Generate list'}
            </Button>
            <Button disabled={!generated || view.counts.unpublished === 0} onClick={() => setConfirmPublish(true)}>
              Publish{view.counts.unpublished ? ` (${view.counts.unpublished} students)` : ''}
            </Button>
          </div>
        </div>
      </section>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {generated && (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ['Students', view.counts.students],
            ['Fully eligible', view.counts.fullyEligible],
            ['Not eligible for some papers', view.counts.withIssues],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg border border-border bg-surface px-4 py-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1 border-b border-border">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              type="button"
              aria-selected={filter === f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm', filter === f.value ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-text')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <label htmlFor="elig-search" className="sr-only">Search students</label>
          <Input id="elig-search" type="search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {!generated ? (
        <EmptyState title="Generate the eligibility list" description="It checks every approved student and course against fee clearance, class attendance and exam holds." />
      ) : view.items.length === 0 ? (
        <EmptyState title="No students match this filter" />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {view.items.map((s) => (
              <li key={s.student.id} className="px-4 py-3">
                <p className="text-sm font-medium">
                  {s.student.firstName} {s.student.lastName} <span className="font-mono text-xs text-muted">{s.student.indexNumber}</span>
                </p>
                <p className="text-xs text-muted">{s.student.studentProfile?.programme.name}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {s.papers.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setOverriding({ paper: p, student: `${s.student.firstName} ${s.student.lastName}` })}
                        title={p.reasons.map((r) => r.text).join('; ') || 'Eligible'}
                        className={cn(
                          'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs',
                          p.status === 'ELIGIBLE' ? 'border-success/40 bg-success-soft text-success' : 'border-danger/40 bg-danger-soft text-danger',
                        )}
                      >
                        <span className="font-mono">{p.offering.course.code}</span>
                        {p.override && <span>(override)</span>}
                        {p.unpublished && <span className="text-muted">, unpublished</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {s.notEligible > 0 && (
                  <p className="mt-1.5 text-xs text-muted">
                    {[...new Set(s.papers.flatMap((p) => p.reasons.map((r) => r.text)))].join('. ')}.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={view.total} onChange={setPage} />
          </div>
        </div>
      )}

      <OverrideDialog
        paper={overriding?.paper ?? null}
        studentLabel={overriding?.student ?? ''}
        onClose={() => setOverriding(null)}
        onDone={() => {
          setOverriding(null);
          setNotice('Override saved. Publish to tell the student.');
          void load();
        }}
      />

      <Dialog open={confirmPublish} onClose={() => setConfirmPublish(false)} title="Publish exam eligibility?">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {view.counts.unpublished} {view.counts.unpublished === 1 ? 'student' : 'students'} will get an email, SMS and in-app notice with their status. The SMS gives a count only, never the reason.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmPublish(false)}>Cancel</Button>
            <Button
              loading={busy === 'publish'}
              onClick={() => run('publish', async () => { const r = await examsApi.publishEligibility(view.semester.id); return `Published. ${r.notified} students notified.`; })}
            >
              Publish
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
