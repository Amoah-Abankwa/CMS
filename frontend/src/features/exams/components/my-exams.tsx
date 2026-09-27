'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { examDay, examTime, examsApi, type MyExams as Data } from '../api';

/** A student's papers, eligibility, and a printable exam entry slip. */
export function MyExams() {
  const me = useAuthStore((s) => s.me);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    examsApi.mine().then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  if (data.papers.length === 0) {
    return <EmptyState title="No approved courses this semester" description="Your exams appear here once your course registration is approved." />;
  }

  const blocked = data.papers.filter((p) => p.eligibility?.status === 'NOT_ELIGIBLE');
  const canPrint = !!data.timetablePublishedAt && !!data.eligibilityPublishedAt;

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden print:block">
        <p className="text-lg font-bold">All Nations University</p>
        <p className="font-semibold">Exam entry slip, {data.semester.label}</p>
        <p className="text-sm">{me && fullName(me)}, {me?.indexNumber}. Printed {formatDateTime(new Date())}.</p>
        <p className="mb-2 text-sm">Bring this slip and your student ID card to every paper. You may only sit papers marked eligible.</p>
      </div>

      <div className="flex flex-col gap-3 print:hidden">
        {!data.timetablePublishedAt && <Alert tone="info">The exam timetable for {data.semester.label} has not been published yet. You will get an email and SMS when it is.</Alert>}
        {!data.eligibilityPublishedAt && <Alert tone="info">Exam eligibility has not been published yet. You will get an email and SMS when it is.</Alert>}
        {blocked.length > 0 && (
          <Alert tone="danger" title={`Not eligible for ${blocked.length} ${blocked.length === 1 ? 'paper' : 'papers'}`}>
            Contact the office named next to each paper before the exam.
          </Alert>
        )}
        {canPrint && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print exam entry slip
            </Button>
          </div>
        )}
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-surface print:border-black">
        {data.papers.map((p) => (
          <li key={p.offeringId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="font-mono">{p.course.code}</span> {p.course.title}
              </p>
              {p.exam ? (
                <p className="text-sm">
                  {examDay(p.exam.startsAt)}, {examTime(p.exam.startsAt, p.exam.durationMinutes)}. {p.exam.venue ?? 'Venue to be announced'}.
                </p>
              ) : (
                <p className="text-sm text-muted">Not on the timetable yet.</p>
              )}
              {p.exam?.notes && <p className="text-xs text-muted">{p.exam.notes}</p>}
              {p.eligibility?.status === 'NOT_ELIGIBLE' && <p className="mt-1 text-xs text-danger">{p.eligibility.reasons.join('. ')}</p>}
            </div>
            <div className="shrink-0">
              {p.eligibility ? (
                <Badge tone={p.eligibility.status === 'ELIGIBLE' ? 'success' : 'danger'}>{p.eligibility.status === 'ELIGIBLE' ? 'Eligible' : 'Not eligible'}</Badge>
              ) : (
                <Badge>Eligibility pending</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
