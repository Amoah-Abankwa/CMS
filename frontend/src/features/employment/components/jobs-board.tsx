'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL, JOB_KIND_LABEL } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { APPLICATION_TONE, cgpaText, workApi, type OpenJobs } from '../api';
import { DispatcherCard } from './dispatcher-card';

export function JobsBoard() {
  const [data, setData] = useState<OpenJobs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => workApi.openJobs().then(setData).catch((err) => setError(errorMessage(err))), []);
  useEffect(() => { void load(); }, [load]);

  const withdraw = async (id: string) => {
    try {
      await workApi.withdraw(id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-muted">
        Your CGPA: <span className="font-medium text-text">{cgpaText(data.standing.cgpa)}</span>. Campus jobs need at least {data.standing.minCgpa.toFixed(2)}, an approved course registration this semester, and no disciplinary hold.
      </p>

      <DispatcherCard />

      <Card>
        <CardHeader title="Open jobs" />
        {data.jobs.length === 0 ? <CardBody><EmptyState title="No jobs open right now" description="Check again soon. New jobs appear here." /></CardBody> : (
          <ul className="divide-y divide-border">
            {data.jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <span className="min-w-0 text-sm">
                    {j.kind && j.kind !== 'CAMPUS_JOB' && <Badge>{JOB_KIND_LABEL[j.kind]}</Badge>} <span className="font-medium">{j.title}</span> <span className="text-muted">{j.organisation ?? j.unit}{j.location ? `, ${j.location}` : ''}</span>{j.applyUrl && <a className="ml-2 text-xs text-primary hover:underline" href={j.applyUrl} target="_blank" rel="noreferrer">Apply on their site</a>}
                    <span className="block text-xs text-muted">
                      {formatCedis(j.payRate)} {PAY_UNIT_LABEL[j.payUnit]}, about {j.hoursPerWeek} hours a week. Closes {formatDate(j.closesAt)}.{j.minCgpa ? ` Needs a CGPA of ${j.minCgpa.toFixed(2)}.` : ''}
                    </span>
                  </span>
                  <span className="shrink-0">
                    {j.myStatus ? <Badge tone={APPLICATION_TONE[j.myStatus]}>{APPLICATION_STATUS_LABEL[j.myStatus]}</Badge> : j.eligibility.eligible ? <Badge tone="success">You can apply</Badge> : <Badge>Not eligible</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.applications.length > 0 && (
        <Card>
          <CardHeader title="My applications" />
          <ul className="divide-y divide-border">
            {data.applications.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{a.job.title}</span> <span className="text-muted">{a.job.unit}</span>
                  <span className="block text-xs text-muted">
                    Applied {formatDate(a.createdAt)}.{a.status === 'HIRED' && a.startedAt ? ` Started ${formatDate(a.startedAt)}.` : ''}{a.decisionNote ? ` ${a.decisionNote}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={APPLICATION_TONE[a.status]}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
                  {(a.status === 'SUBMITTED' || a.status === 'SHORTLISTED') && <Button variant="ghost" size="sm" onClick={() => withdraw(a.id)}>Withdraw</Button>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
