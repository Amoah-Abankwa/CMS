'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { resultsApi, SHEET_STATUS, type GradingScale, type SheetDetail as Detail } from '../api';
import { GradeDistribution } from './grade-distribution';

function Timeline({ sheet }: { sheet: Detail }) {
  const steps = [
    { label: 'Submitted by lecturer', at: sheet.submittedAt },
    { label: 'Approved by Head of Department', at: sheet.hodApprovedAt },
    { label: 'Approved by Dean', at: sheet.deanApprovedAt },
    { label: 'Published to students', at: sheet.publishedAt },
  ];
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:gap-6">
      {steps.map((s, i) => (
        <li key={s.label} className={cn('flex items-start gap-2 text-sm', !s.at && 'text-muted')}>
          <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs', s.at ? 'bg-success text-white' : 'border border-border')}>{i + 1}</span>
          <span>
            {s.label}
            {s.at && <span className="block text-xs text-muted">{formatDateTime(s.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SheetDetail({ id }: { id: string }) {
  const [sheet, setSheet] = useState<Detail | null>(null);
  const [scale, setScale] = useState<GradingScale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'advance' | 'return' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    resultsApi.sheet(id).then(setSheet).catch((err) => setError(errorMessage(err)));
    resultsApi.scale().then(setScale).catch(() => undefined);
  }, [id]);

  if (error && !sheet) return <Alert tone="danger">{error}</Alert>;
  if (!sheet) return <Spinner />;

  const publish = sheet.nextAction === 'publish';
  const act = async (kind: 'advance' | 'return') => {
    if (kind === 'return' && note.trim().length < 5) return setError('Tell the lecturer what to correct.');
    setBusy(kind);
    setError(null);
    try {
      const updated = kind === 'advance' ? await resultsApi.advance(id) : await resultsApi.returnSheet(id, note.trim());
      setSheet(updated);
      setNotice(kind === 'return' ? 'Returned to the lecturer.' : publish ? 'Published. Students have been notified by email and SMS.' : 'Approved. The next approver has been notified.');
      setConfirming(false);
      setReturning(false);
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const order = scale?.bands.map((b) => b.letter).concat('IC') ?? [];

  return (
    <>
      <PageHeader
        title={`${sheet.offering.course.code} ${sheet.offering.course.title}`}
        description={`${sheet.offering.semesterLabel}. ${sheet.offering.course.department.name}. ${sheet.offering.lecturers.map((l) => l.name + (l.isLead ? ' (lead)' : '')).join(', ')}.`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SHEET_STATUS[sheet.status].tone}>{SHEET_STATUS[sheet.status].label}</Badge>
          {sheet.scale && <span className="text-xs text-muted">Graded with {sheet.scale.name}, version {sheet.scale.version}</span>}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <Card>
          <CardBody>
            <Timeline sheet={sheet} />
          </CardBody>
        </Card>

        {sheet.canAct && (
          <section className="flex flex-col gap-3 rounded-lg border border-primary bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p className="text-sm">{publish ? 'These results have both approvals. Publishing shows them to students and sends each one an email and SMS.' : 'These results are waiting for your approval.'}</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setReturning(true)}>
                Return for changes
              </Button>
              <Button onClick={() => setConfirming(true)}>{publish ? 'Publish results' : 'Approve'}</Button>
            </div>
          </section>
        )}

        <Card>
          <CardHeader title="Grade distribution" />
          <CardBody>
            <GradeDistribution summary={sheet.summary} order={order} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Student results" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Index number</th>
                  <th scope="col" className="px-4 py-2 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">CA</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Exam</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sheet.results.map((r) => (
                  <tr key={r.student.id}>
                    <td className="whitespace-nowrap px-4 py-2 font-mono">{r.student.indexNumber}</td>
                    <td className="px-4 py-2">{fullName(r.student)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.caScore}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.examScore}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{r.total}</td>
                    <td className={cn('px-4 py-2 font-medium', r.incomplete ? 'text-warning' : !r.isPass && 'text-danger')}>{r.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={publish ? 'Publish these results?' : 'Approve these results?'} description={`${sheet.offering.course.code}, ${sheet.summary.students} students`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">{publish ? 'Students will see their grades immediately and be notified. Published results cannot be changed here.' : 'They will move to the next approver.'}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button loading={busy === 'advance'} onClick={() => act('advance')}>
              {publish ? 'Publish results' : 'Approve'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={returning} onClose={() => setReturning(false)} title="Return to the lecturer" description="Marks become editable again and the lecturer must resubmit.">
        <div className="flex flex-col gap-4">
          <Field label="What needs correcting" htmlFor="return-note">
            <Textarea id="return-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReturning(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === 'return'} onClick={() => act('return')}>
              Return results
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
