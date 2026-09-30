'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { examDay, examTime, examsApi, type StaffOption, type TimetableView, type Venue } from '../api';
import { PaperDialog, type PaperTarget } from './paper-dialog';

export function TimetableManager() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [view, setView] = useState<TimetableView | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [editing, setEditing] = useState<PaperTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    examsApi.venues().then(setVenues).catch(() => setVenues([]));
    examsApi.staffOptions().then(setStaff).catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    setView(null);
    examsApi.timetable(semesterId || undefined).then(setView).catch((err) => setError(errorMessage(err)));
  }, [semesterId]);

  if (error && !view) return <Alert tone="danger">{error}</Alert>;
  if (!view) return <Spinner />;

  const errors = view.issues.filter((i) => i.severity === 'error');
  const warnings = view.issues.filter((i) => i.severity === 'warning');
  const flagged = new Set(errors.flatMap((i) => ('sessionIds' in i ? i.sessionIds : [])));
  const days = new Map<string, TimetableView['sessions']>();
  for (const s of view.sessions) {
    const d = examDay(s.startsAt);
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(s);
  }
  const published = view.timetable.publishedVersion > 0;

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const v = await examsApi.publishTimetable(view.semester.id);
      setView(v);
      setNotice(`Timetable ${published ? 'updated' : 'published'}. ${v.notified ?? 0} students notified.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPublishing(false);
      setConfirm(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {semesters && (
        <div className="max-w-sm">
          <SemesterSelect semesters={semesters} value={semesterId} onChangeAction={setSemesterId} />
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">{view.semester.label}</p>
          <p className="text-muted">
            {published ? `Published ${formatDateTime(view.timetable.publishedAt!)} (version ${view.timetable.publishedVersion}). ` : 'Not published yet. Students cannot see it. '}
            {view.pendingChanges > 0 && published && `${view.pendingChanges} ${view.pendingChanges === 1 ? 'paper has' : 'papers have'} changed since.`}
          </p>
        </div>
        <Button onClick={() => setConfirm(true)} disabled={errors.length > 0 || view.sessions.length === 0 || (published && view.pendingChanges === 0)}>
          {published ? 'Publish changes' : 'Publish timetable'}
        </Button>
      </section>

      {published && (
        <section className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={() => api.post<{ seated: number; papers: number; overfull: string[] }>(`/exams/timetables/${view.timetable.id}/seats`).then((r) => { setNotice(`Seats numbered for ${r.data.seated} candidates across ${r.data.papers} papers.${r.data.overfull.length ? ` Over capacity: ${r.data.overfull.join('; ')}.` : ''}`); }).catch((err) => setError(errorMessage(err)))}>Number seats</Button>
          <Button variant="secondary" size="sm" onClick={() => api.post<{ invigilators: number }>(`/exams/timetables/${view.timetable.id}/notify-invigilators`).then((r) => setNotice(`Duty lists sent to ${r.data.invigilators} invigilators by email, SMS and in-app.`)).catch((err) => setError(errorMessage(err)))}>Send invigilator duties</Button>
          <span className="text-xs text-muted">Number seats after registrations are approved; run it again after changes. Invigilators mark attendance under Exam register.</span>
        </section>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {errors.length > 0 && (
        <Alert tone="danger" title={`${errors.length} ${errors.length === 1 ? 'clash' : 'clashes'} to fix before publishing`}>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((i, n) => <li key={n}>{i.message}</li>)}
          </ul>
        </Alert>
      )}
      {warnings.length > 0 && (
        <details className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">{warnings.length} {warnings.length === 1 ? 'thing' : 'things'} to check (these do not block publishing)</summary>
          <ul className="mt-2 list-disc pl-5 text-muted">
            {warnings.map((i, n) => <li key={n}>{i.message}</li>)}
          </ul>
        </details>
      )}

      {view.sessions.length === 0 && <EmptyState title="No papers scheduled yet" description="Schedule papers from the list of courses below." />}
      {[...days].map(([day, papers]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold">{day}</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {papers.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ offeringId: p.offeringId, label: p.course.code, students: p.students, paper: p })}
                  className={cn('flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-4', flagged.has(p.id) && 'bg-danger-soft/50')}
                >
                  <span className="w-32 shrink-0 text-sm tabular-nums">{examTime(p.startsAt, p.durationMinutes)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {flagged.has(p.id) && <TriangleAlert className="mr-1 inline size-4 text-danger" aria-label="Has a clash" />}
                      <span className="font-mono">{p.course.code}</span> {p.course.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.students} students. {p.venue ? p.venue.name : 'Venue to be announced'}.{' '}
                      {p.invigilators.length ? `Invigilators: ${p.invigilators.map((i) => i.name).join(', ')}.` : 'No invigilator yet.'}
                    </span>
                  </span>
                  {p.changedSincePublish && <Badge tone="warning">Changed since published</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {view.unscheduled.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Not yet scheduled</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {view.unscheduled.map((u) => (
              <li key={u.offeringId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="font-mono">{u.course.code}</span> {u.course.title}
                  <span className="block text-xs text-muted">{u.students ? `${u.students} approved students` : 'No approved students yet'}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => setEditing({ offeringId: u.offeringId, label: u.course.code, students: u.students })}>
                  Schedule
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PaperDialog
        target={editing}
        venues={venues}
        staff={staff}
        onClose={() => setEditing(null)}
        onSaved={(v) => {
          setView(v);
          setEditing(null);
          setNotice(null);
        }}
      />

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={published ? 'Publish timetable changes?' : 'Publish the exam timetable?'}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {published
              ? `Students taking the ${view.pendingChanges} changed ${view.pendingChanges === 1 ? 'paper' : 'papers'} will get an email, SMS and in-app notice listing what changed.`
              : 'Every student with approved courses will get an email, SMS and in-app notice, and can see their papers.'}
          </p>
          {warnings.length > 0 && <p className="text-sm text-muted">{warnings.length} warnings remain, such as papers without a venue.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button loading={publishing} onClick={publish}>
              {published ? 'Publish changes' : 'Publish timetable'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
