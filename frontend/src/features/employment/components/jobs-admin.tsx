'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCedis, PAY_UNIT_LABEL, type JobPayUnit } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { workApi, type AdminJob, type Job } from '../api';

const STATUS_TONE = { DRAFT: 'neutral', OPEN: 'success', CLOSED: 'neutral' } as const;
const STATUS_LABEL = { DRAFT: 'Draft', OPEN: 'Open', CLOSED: 'Closed' } as const;

export function JobsAdmin() {
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminJob | 'new' | null>(null);
  const load = useCallback(() => workApi.jobs().then(setJobs).catch((err) => setError(errorMessage(err))), []);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (j: AdminJob, status: Job['status']) => {
    setError(null);
    try {
      await workApi.setJobStatus(j.id, status);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title="Jobs" description="Students only see open jobs. Jobs close by themselves on their closing date." actions={<Button size="sm" onClick={() => setEditing('new')}>Post a job</Button>} />
        {!jobs ? <CardBody><Spinner /></CardBody> : jobs.length === 0 ? <CardBody><EmptyState title="No jobs yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <Link href={`/employment/jobs/${j.id}`} className="min-w-0 text-sm hover:underline">
                  <span className="flex flex-wrap items-center gap-2 font-medium">{j.title} <Badge tone={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Badge>{j.waiting > 0 && <Badge tone="primary">{j.waiting} new</Badge>}</span>
                  <span className="block text-xs text-muted">
                    {j.unit}. {formatCedis(j.payRate)} {PAY_UNIT_LABEL[j.payUnit]}, {j.hoursPerWeek} h a week. {j.hired} of {j.positions} hired, {j.applicants} applicants. Closes {formatDate(j.closesAt)}.
                  </span>
                </Link>
                <span className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(j)}>Edit</Button>
                  {j.status !== 'OPEN' && <Button variant="secondary" size="sm" onClick={() => setStatus(j, 'OPEN')}>Open</Button>}
                  {j.status === 'OPEN' && <Button variant="secondary" size="sm" onClick={() => setStatus(j, 'CLOSED')}>Close</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <JobDialog target={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void load(); }} />
    </div>
  );
}

function JobDialog({ target, onClose, onDone }: { target: AdminJob | 'new' | null; onClose: () => void; onDone: () => void }) {
  const blank = { title: '', unit: '', description: '', hoursPerWeek: '8', payRate: '', payUnit: 'HOUR' as JobPayUnit, positions: '1', minCgpa: '', closesAt: '', supervisorEmail: '' };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!target) return;
    const j = target === 'new' ? null : target;
    setF(j ? {
      title: j.title, unit: j.unit, description: j.description, hoursPerWeek: String(j.hoursPerWeek), payRate: String(j.payRate / 100), payUnit: j.payUnit,
      positions: String(j.positions), minCgpa: j.minCgpa ? j.minCgpa.toFixed(2) : '', closesAt: j.closesAt.slice(0, 10), supervisorEmail: j.supervisor?.email ?? '',
    } : blank);
    setError(null);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!target) return null;
  const existing = target === 'new' ? null : target;
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await workApi.saveJob({
        title: f.title.trim(), unit: f.unit.trim(), description: f.description.trim(), hoursPerWeek: Number(f.hoursPerWeek), payRate: Math.round(Number(f.payRate) * 100), payUnit: f.payUnit,
        positions: Number(f.positions), minCgpa: f.minCgpa ? Number(f.minCgpa) : null, closesAt: `${f.closesAt}T23:59:00.000Z`, supervisorEmail: f.supervisorEmail.trim() || undefined,
      }, existing?.id);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={existing ? `Edit ${existing.title}` : 'Post a job'} description={existing ? undefined : 'It is saved as a draft. Open it when you are ready for students to apply.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job title" htmlFor="jb-title"><Input id="jb-title" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Office or department" htmlFor="jb-unit"><Input id="jb-unit" value={f.unit} maxLength={80} onChange={(e) => set('unit', e.target.value)} /></Field>
        </div>
        <Field label="What the student will do" htmlFor="jb-desc"><Textarea id="jb-desc" value={f.description} maxLength={3000} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pay (GH₵)" htmlFor="jb-pay"><Input id="jb-pay" type="number" inputMode="decimal" value={f.payRate} onChange={(e) => set('payRate', e.target.value)} /></Field>
          <Field label="Paid" htmlFor="jb-unitpay">
            <Select id="jb-unitpay" value={f.payUnit} onChange={(e) => set('payUnit', e.target.value)}>
              <option value="HOUR">Per hour</option>
              <option value="MONTH">Per month</option>
              <option value="TASK">Per task</option>
            </Select>
          </Field>
          <Field label="Hours a week" htmlFor="jb-hours" hint="At most 20."><Input id="jb-hours" type="number" min={1} max={20} value={f.hoursPerWeek} onChange={(e) => set('hoursPerWeek', e.target.value)} /></Field>
          <Field label="Places" htmlFor="jb-pos"><Input id="jb-pos" type="number" min={1} max={50} value={f.positions} onChange={(e) => set('positions', e.target.value)} /></Field>
          <Field label="Minimum CGPA (optional)" htmlFor="jb-cgpa" hint="Only if higher than the university minimum."><Input id="jb-cgpa" type="number" step="0.01" min={0} max={4} value={f.minCgpa} onChange={(e) => set('minCgpa', e.target.value)} /></Field>
          <Field label="Closing date" htmlFor="jb-close"><Input id="jb-close" type="date" value={f.closesAt} onChange={(e) => set('closesAt', e.target.value)} /></Field>
        </div>
        <Field label="Supervisor's email (optional)" htmlFor="jb-sup" hint="A staff member. They are told when a student is hired."><Input id="jb-sup" type="email" value={f.supervisorEmail} onChange={(e) => set('supervisorEmail', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={f.title.trim().length < 3 || f.unit.trim().length < 2 || f.description.trim().length < 20 || !(Number(f.payRate) >= 1) || !f.closesAt} onClick={save}>Save job</Button>
        </div>
      </div>
    </Dialog>
  );
}
