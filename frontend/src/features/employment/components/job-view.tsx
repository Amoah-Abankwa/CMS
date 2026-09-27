'use client';

import { useCallback, useEffect, useState } from 'react';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { APPLICATION_TONE, workApi, type StudentJob } from '../api';
import { EligibilityNote } from './eligibility-note';

export function JobView({ id }: { id: string }) {
  const [job, setJob] = useState<StudentJob | null>(null);
  const [statement, setStatement] = useState('');
  const [availability, setAvailability] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => workApi.job(id).then(setJob).catch((err) => setError(errorMessage(err))), [id]);
  useEffect(() => { void load(); }, [load]);

  if (!job) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const open = job.status === 'OPEN' && new Date(job.closesAt) > new Date();
  const mine = job.myApplication && job.myApplication.status !== 'WITHDRAWN' ? job.myApplication : null;

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      await workApi.apply(id, { statement: statement.trim(), availability: availability.trim() || undefined });
      setSent(true);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={job.title} description={job.unit} actions={mine ? <Badge tone={APPLICATION_TONE[mine.status]}>{APPLICATION_STATUS_LABEL[mine.status]}</Badge> : undefined} />
        <CardBody className="flex flex-col gap-3">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Pay</dt><dd>{formatCedis(job.payRate)} {PAY_UNIT_LABEL[job.payUnit]}</dd></div>
            <div><dt className="text-muted">Hours</dt><dd>About {job.hoursPerWeek} a week</dd></div>
            <div><dt className="text-muted">Places</dt><dd>{job.positions}</dd></div>
            <div><dt className="text-muted">Closes</dt><dd>{formatDate(job.closesAt)}</dd></div>
            {job.supervisor && <div><dt className="text-muted">Supervisor</dt><dd>{job.supervisor.firstName} {job.supervisor.lastName}</dd></div>}
            {job.minCgpa && <div><dt className="text-muted">Minimum CGPA</dt><dd>{job.minCgpa.toFixed(2)}</dd></div>}
          </dl>
          <p className="whitespace-pre-line text-sm">{job.description}</p>
        </CardBody>
      </Card>

      {sent && <Alert tone="success">Application sent. Career Services will be in touch by email.</Alert>}
      {mine ? (
        !sent && <Alert tone="info">You applied for this job.{mine.decisionNote ? ` ${mine.decisionNote}` : ''}</Alert>
      ) : !open ? (
        <Alert tone="info">This job is no longer taking applications.</Alert>
      ) : (
        <Card>
          <CardHeader title="Apply" />
          <CardBody className="flex flex-col gap-4">
            <EligibilityNote eligibility={job.eligibility} cgpa={job.eligibility.cgpa} />
            {error && <Alert tone="danger">{error}</Alert>}
            {job.eligibility.eligible && (
              <>
                <Field label="Why you want this job" htmlFor="ap-st" hint="Relevant experience, and why you would do it well."><Textarea id="ap-st" value={statement} maxLength={1500} onChange={(e) => setStatement(e.target.value)} /></Field>
                <Field label="When you are free (optional)" htmlFor="ap-av"><Input id="ap-av" value={availability} maxLength={300} onChange={(e) => setAvailability(e.target.value)} placeholder="For example: weekday afternoons, Saturdays" /></Field>
                <div><Button loading={busy} disabled={statement.trim().length < 30} onClick={apply}>Send application</Button></div>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
