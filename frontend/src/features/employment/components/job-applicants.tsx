'use client';

import { useCallback, useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { APPLICATION_TONE, cgpaText, workApi, type Applicant, type JobDetail } from '../api';

type Decision = 'SHORTLISTED' | 'HIRED' | 'REJECTED' | 'ENDED';
const VERB: Record<Decision, string> = { SHORTLISTED: 'Shortlist', HIRED: 'Hire', REJECTED: 'Turn down', ENDED: 'End job' };

/** Applicants with their CGPA and whether they meet the rules today. */
export function JobApplicants({ id, scope = 'careers' }: { id: string; scope?: 'careers' | 'owner' }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ a: Applicant; status: Decision } | null>(null);
  const load = useCallback(() => (scope === 'owner' ? api.get<JobDetail>(`/opportunities/jobs/${id}`).then((r) => r.data) : workApi.jobDetail(id)).then(setJob).catch((err) => setError(errorMessage(err))), [id, scope]);
  useEffect(() => { void load(); }, [load]);

  if (!job) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const active = job.applications.filter((a) => a.status !== 'WITHDRAWN');
  const hired = active.filter((a) => a.status === 'HIRED').length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={job.title} description={`${job.unit}. ${formatCedis(job.payRate)} ${PAY_UNIT_LABEL[job.payUnit]}, ${job.hoursPerWeek} hours a week. ${hired} of ${job.positions} places filled.${job.minCgpa ? ` Needs a CGPA of ${job.minCgpa.toFixed(2)}.` : ''}`} />
        {active.length === 0 ? <CardBody><EmptyState title="No applicants yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {active.map((a) => {
              const flagged = !a.eligibility.eligible && ['SUBMITTED', 'SHORTLISTED', 'HIRED'].includes(a.status);
              return (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <span className="text-sm">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {a.student.firstName} {a.student.lastName} <span className="font-normal text-muted">{a.student.indexNumber}</span>
                        <Badge tone={APPLICATION_TONE[a.status]}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
                      </span>
                      <span className="block text-xs text-muted">
                        {a.student.studentProfile ? `${a.student.studentProfile.programme.name}, level ${a.student.studentProfile.currentLevel}. ` : ''}CGPA {cgpaText(a.cgpa)}. Applied {formatDate(a.createdAt)}. {a.student.phone ?? ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap gap-2">
                      {a.status === 'SUBMITTED' && <Button variant="secondary" size="sm" onClick={() => setDeciding({ a, status: 'SHORTLISTED' })}>Shortlist</Button>}
                      {(a.status === 'SUBMITTED' || a.status === 'SHORTLISTED') && (
                        <>
                          <Button size="sm" disabled={!a.eligibility.eligible || hired >= job.positions} onClick={() => setDeciding({ a, status: 'HIRED' })}>Hire</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeciding({ a, status: 'REJECTED' })}>Turn down</Button>
                        </>
                      )}
                      {a.status === 'HIRED' && <Button variant="ghost" size="sm" onClick={() => setDeciding({ a, status: 'ENDED' })}>End job</Button>}
                    </span>
                  </div>
                  {flagged && (
                    <Alert tone="warning" title={a.status === 'HIRED' ? 'No longer meets the rules' : 'Does not meet the rules'}>
                      {a.eligibility.reasons.join(' ')}
                    </Alert>
                  )}
                  <p className="whitespace-pre-line rounded-md bg-surface-muted px-3 py-2 text-sm">{a.statement}{a.availability ? `\n\nAvailable: ${a.availability}` : ''}</p>
                  {a.decisionNote && <p className="text-xs text-muted">Note: {a.decisionNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <DecisionDialog scope={scope} target={deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); void load(); }} />
    </div>
  );
}

function DecisionDialog({ scope, target, onClose, onDone }: { scope: 'careers' | 'owner'; target: { a: Applicant; status: Decision } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [start, setStart] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setStart(new Date().toISOString().slice(0, 10)); setError(null); }, [target]);
  if (!target) return null;
  const { a, status } = target;
  const needsReason = status === 'REJECTED' || status === 'ENDED';
  const submit = async () => {
    setBusy(true);
    try {
      await (scope === 'owner' ? (a: string, d: Parameters<typeof workApi.decide>[1]) => api.post(`/opportunities/applications/${a}/decision`, d) : workApi.decide)(a.id, { status, note: note.trim() || undefined, startDate: status === 'HIRED' ? `${start}T08:00:00.000Z` : undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${VERB[status]}: ${a.student.firstName} ${a.student.lastName}?`}
      description={status === 'HIRED' ? 'They get an email, SMS and in-app message. The supervisor is told too.' : `${a.student.firstName} is told${needsReason ? ', with your reason' : ''}.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {status === 'HIRED' && <Field label="Start date" htmlFor="dc-start"><Input id="dc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>}
        <Field label={needsReason ? 'Reason (the student sees it)' : 'Note to the student (optional)'} htmlFor="dc-note"><Textarea id="dc-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={needsReason ? 'danger' : 'primary'} loading={busy} disabled={needsReason && note.trim().length < 3} onClick={submit}>{VERB[status]}</Button>
        </div>
      </div>
    </Dialog>
  );
}
