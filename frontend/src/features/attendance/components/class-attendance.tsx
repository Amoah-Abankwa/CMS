'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/axios';
import { fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { attendanceApi, classWhen, KIND_LABEL, type ClassAttendance as Data, type ClassSession } from '../api';
import { AttendanceBar } from './attendance-bar';
import { RegisterView } from './register-view';
import { SessionDialog } from './session-dialog';

/** The Attendance tab on a class page. */
export function ClassAttendance({ offeringId }: { offeringId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassSession | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = () => attendanceApi.overview(offeringId).then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, [offeringId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const courseLabel = `${data.offering.course.code} ${data.offering.course.title}`;

  if (openSession) {
    return <RegisterView offeringId={offeringId} sessionId={openSession} courseLabel={courseLabel} onBack={() => { setOpenSession(null); void load(); }} />;
  }

  const now = Date.now();
  const soon = now + 15 * 60_000;
  const due = data.sessions.filter((s) => !s.cancelledAt && !s.attendanceTakenAt && new Date(s.startsAt).getTime() <= soon);
  const upcoming = data.sessions.filter((s) => !s.cancelledAt && new Date(s.startsAt).getTime() > soon);
  const done = data.sessions.filter((s) => s.attendanceTakenAt || s.cancelledAt).reverse();
  const low = data.students.filter((s) => s.belowMinimum);

  const row = (s: ClassSession, action: React.ReactNode) => (
    <li key={s.id} className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', s.cancelledAt && 'opacity-70')}>
      <span className="min-w-0 text-sm">
        <span className="font-medium">{classWhen(s.startsAt, s.durationMinutes)}</span> <span className="text-muted">{KIND_LABEL[s.kind]}{s.venue ? `, ${s.venue}` : ''}</span>
        {s.topic && <span className="block text-xs text-muted">{s.topic}</span>}
        {s.cancelledAt && <span className="block text-xs text-muted">Cancelled: {s.cancelReason}</span>}
        {s.attendanceTakenAt && (
          <span className="block text-xs text-muted">
            {s.counts.present} present, {s.counts.late} late, {s.counts.absent} absent{s.counts.excused ? `, ${s.counts.excused} excused` : ''}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {s.checkInOpen && <Badge tone="primary">Check-in open</Badge>}
        {s.cancelledAt && <Badge>Cancelled</Badge>}
        {action}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={courseLabel}
        description={`${data.offering.semesterLabel}. Minimum attendance ${data.policy.minimumPercent}%. Late counts as attended; excused absences are not counted.`}
        actions={<Button size="sm" onClick={() => setAdding(true)}>Add classes</Button>}
      />
      {data.sessions.length === 0 && <EmptyState title="No classes yet" description="Add your weekly class times once, and they repeat for the semester." action={<Button onClick={() => setAdding(true)}>Add classes</Button>} />}

      {due.length > 0 && (
        <Card>
          <CardHeader title="Take attendance" description="Classes that have started and have no register yet." />
          <ul className="divide-y divide-border">{due.map((s) => row(s, <Button size="sm" onClick={() => setOpenSession(s.id)}>Take attendance</Button>))}</ul>
        </Card>
      )}

      {low.length > 0 && (
        <Alert tone="warning" title={`${low.length} ${low.length === 1 ? 'student is' : 'students are'} below ${data.policy.minimumPercent}%`}>
          {low.map((s) => `${fullName(s)} (${s.summary?.percent}%)`).join(', ')}. They are warned automatically after {data.policy.warnAfterSessions} classes.
        </Alert>
      )}

      <Card>
        <CardHeader title="Students" />
        <ul className="divide-y divide-border">
          {data.students.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm"><span className="font-mono text-xs text-muted">{s.indexNumber}</span> {fullName(s)}</span>
              <span className="flex items-center gap-3">
                {s.summary && <span className="text-xs text-muted">{s.summary.present + s.summary.late} of {s.summary.counted}</span>}
                <AttendanceBar percent={s.summary?.percent ?? null} minimum={data.policy.minimumPercent} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader title="Coming up" />
          <ul className="divide-y divide-border">{upcoming.slice(0, 6).map((s) => row(s, <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>Edit</Button>))}</ul>
          {upcoming.length > 6 && <p className="border-t border-border px-4 py-2 text-xs text-muted">{upcoming.length - 6} more later in the semester.</p>}
        </Card>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader title="Past classes" actions={<Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>{showPast ? 'Hide' : `Show ${done.length}`}</Button>} />
          {showPast && <ul className="divide-y divide-border">{done.map((s) => row(s, s.attendanceTakenAt ? <Button variant="secondary" size="sm" onClick={() => setOpenSession(s.id)}>Open register</Button> : null))}</ul>}
        </Card>
      )}

      <SessionDialog open={adding || !!editing} offeringId={offeringId} session={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={(d) => { setData(d); setAdding(false); setEditing(null); }} />
    </div>
  );
}
