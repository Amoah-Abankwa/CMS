'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, JOB_KIND_LABEL, PAY_UNIT_LABEL, PERMISSIONS, TIMESHEET_STATUS_LABEL, type JobKind, type JobPayUnit, type TimesheetStatus } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/stores/auth.store';
import { PayNowButton } from '@/features/fees/components/pay-now';
import { JobApplicants } from './job-applicants';

interface Posting { id: string; title: string; unit: string; kind: JobKind; status: 'DRAFT' | 'PENDING_REVIEW' | 'OPEN' | 'CLOSED'; closesAt: string; payRate: number; payUnit: JobPayUnit; organisation: string | null; applicants: number; waiting: number; hired: number }
interface Sheet {
  id: string; period: string; status: TimesheetStatus; amount: number; note: string | null; returnNote: string | null; paidAt: string | null; paidReference: string | null;
  entries: Array<{ id: string; date: string; quantity: number; note: string | null }>;
  application: { id: string; payoutNetwork: string | null; payoutNumber: string | null; student: { firstName: string; lastName: string; indexNumber: string | null }; job: { title: string; unit: string; payRate: number; payUnit: JobPayUnit; hoursPerWeek: number } };
}
const STATUS = { DRAFT: 'Draft', PENDING_REVIEW: 'Waiting for Career Services', OPEN: 'Open', CLOSED: 'Closed' } as const;
const payslip = (id: string) => `/api/v1/opportunities/timesheets/${id}/payslip`;

/** Staff: post internships; lecturers: teaching and research assistantships. Plus timesheets to approve. */
export function Opportunities() {
  const lecturer = useAuthStore((s) => s.can(PERMISSIONS.TEACHING_READ));
  const [list, setList] = useState<Posting[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const empty = { kind: 'INTERNSHIP' as JobKind, title: '', unit: '', organisation: '', location: '', applyUrl: '', description: '', hoursPerWeek: '10', payRate: '', payUnit: 'HOUR' as JobPayUnit, positions: '1', minCgpa: '', closesAt: '' };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => {
    api.get<Posting[]>('/opportunities').then((r) => setList(r.data)).catch(() => setList([]));
    api.get<Sheet[]>('/opportunities/timesheets').then((r) => setSheets(r.data)).catch(() => setSheets([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (open) return <div className="flex flex-col gap-3"><div><Button variant="ghost" size="sm" onClick={() => setOpen(null)}>All my postings</Button></div><JobApplicants id={open} scope="owner" /></div>;
  const kinds: JobKind[] = lecturer ? ['INTERNSHIP', 'TEACHING_ASSISTANT', 'RESEARCH_ASSISTANT'] : ['INTERNSHIP'];
  const post = () => api.post('/opportunities', {
    kind: f.kind, title: f.title.trim(), unit: f.unit.trim() || f.organisation.trim(), organisation: f.organisation.trim() || undefined, location: f.location.trim() || undefined, applyUrl: f.applyUrl.trim() || undefined,
    description: f.description.trim(), hoursPerWeek: Number(f.hoursPerWeek), payRate: Math.round(Number(f.payRate || 0) * 100), payUnit: f.payUnit, positions: Number(f.positions), minCgpa: f.minCgpa ? Number(f.minCgpa) : null, closesAt: `${f.closesAt}T23:59:00.000Z`,
  }).then(() => { setMsg({ tone: 'success', text: 'Posted. Career Services checks it, then students can see it.' }); setF(empty); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  const review = (t: Sheet, approve: boolean) => {
    const note = approve ? undefined : window.prompt('What should the student correct?') ?? '';
    if (!approve && !note) return;
    api.post(`/opportunities/timesheets/${t.id}/review`, { approve, note }).then(() => { setMsg({ tone: 'success', text: approve ? 'Approved; Finance will pay it.' : 'Returned to the student.' }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  };
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {sheets.length > 0 && (
        <Card>
          <CardHeader title="Timesheets to approve" description="Students you supervise. Approved timesheets go to Finance for payment." />
          <ul className="divide-y divide-border">
            {sheets.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{t.application.student.firstName} {t.application.student.lastName}</span> <span className="text-muted">{t.application.job.title}, {t.period}: {formatCedis(t.amount)}</span></span>
                  <span className="flex gap-2"><a className="self-center text-xs text-primary hover:underline" href={payslip(t.id)} download>PDF</a><Button size="sm" onClick={() => review(t, true)}>Approve</Button><Button variant="ghost" size="sm" onClick={() => review(t, false)}>Return</Button></span>
                </div>
                {t.entries.length > 0 && <p className="text-xs text-muted">{t.entries.map((e) => `${e.date.slice(5)}: ${e.quantity}${t.application.job.payUnit === 'HOUR' ? 'h' : ''}${e.note ? ` (${e.note})` : ''}`).join('; ')}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Post an opportunity" description={lecturer ? 'Internships for students, or teaching and research assistantships for your courses and projects.' : 'Internships for students with organisations you know.'} />
        <CardBody className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Kind" htmlFor="op-k"><Select id="op-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as JobKind })}>{kinds.map((k) => <option key={k} value={k}>{JOB_KIND_LABEL[k]}</option>)}</Select></Field>
            <Field label="Title" htmlFor="op-t"><Input id="op-t" value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            {f.kind === 'INTERNSHIP'
              ? <Field label="Organisation" htmlFor="op-o"><Input id="op-o" value={f.organisation} maxLength={120} onChange={(e) => setF({ ...f, organisation: e.target.value })} /></Field>
              : <Field label="Course or project" htmlFor="op-u"><Input id="op-u" value={f.unit} maxLength={80} placeholder="CSC 201 or the research project" onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>}
          </div>
          {f.kind === 'INTERNSHIP' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Location" htmlFor="op-l"><Input id="op-l" value={f.location} maxLength={120} placeholder="Accra, or remote" onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
              <Field label="Apply on their site (optional)" htmlFor="op-a" hint="Leave empty to take applications here."><Input id="op-a" value={f.applyUrl} placeholder="https://" onChange={(e) => setF({ ...f, applyUrl: e.target.value })} /></Field>
            </div>
          )}
          <Field label="Description" htmlFor="op-d" hint="What the student will do, what they need, and how they will be supported."><Textarea id="op-d" value={f.description} maxLength={3000} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Hours a week" htmlFor="op-h"><Input id="op-h" type="number" min={1} max={20} value={f.hoursPerWeek} onChange={(e) => setF({ ...f, hoursPerWeek: e.target.value })} /></Field>
            <Field label="Pay (GH₵)" htmlFor="op-p" hint={f.kind === 'INTERNSHIP' ? '0 if unpaid' : undefined}><Input id="op-p" type="number" min={0} value={f.payRate} onChange={(e) => setF({ ...f, payRate: e.target.value })} /></Field>
            <Field label="Per" htmlFor="op-pu"><Select id="op-pu" value={f.payUnit} onChange={(e) => setF({ ...f, payUnit: e.target.value as JobPayUnit })}><option value="HOUR">hour</option><option value="MONTH">month</option><option value="TASK">task</option></Select></Field>
            <Field label="Places" htmlFor="op-n"><Input id="op-n" type="number" min={1} value={f.positions} onChange={(e) => setF({ ...f, positions: e.target.value })} /></Field>
            <Field label="Min CGPA" htmlFor="op-c"><Input id="op-c" type="number" step="0.01" min={0} max={4} value={f.minCgpa} onChange={(e) => setF({ ...f, minCgpa: e.target.value })} /></Field>
            <Field label="Closes" htmlFor="op-cl"><Input id="op-cl" type="date" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} /></Field>
          </div>
          <div><Button disabled={f.title.trim().length < 3 || f.description.trim().length < 20 || !f.closesAt || (f.kind === 'INTERNSHIP' ? f.organisation.trim().length < 2 : f.unit.trim().length < 2)} onClick={post}>Post</Button></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Your postings" />
        {!list ? <CardBody><Spinner /></CardBody> : list.length === 0 ? <CardBody><EmptyState title="Nothing posted yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {list.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span><Badge>{JOB_KIND_LABEL[j.kind]}</Badge> <span className="font-medium">{j.title}</span> <span className="text-muted">{j.organisation ?? j.unit}. {j.payRate ? `${formatCedis(j.payRate)} ${PAY_UNIT_LABEL[j.payUnit]}` : 'Unpaid'}. Closes {formatDate(j.closesAt)}. {j.applicants} applied, {j.hired} taken on.</span></span>
                <span className="flex items-center gap-2"><Badge tone={j.status === 'OPEN' ? 'success' : j.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>{STATUS[j.status]}</Badge>{j.waiting > 0 && <Badge tone="primary">{j.waiting} new</Badge>}<Button size="sm" variant="secondary" onClick={() => setOpen(j.id)}>Applicants</Button>{j.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => api.post(`/opportunities/${j.id}/close`).then(load)}>Close</Button>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface Hire { id: string; status: string; startedAt: string | null; payoutNetwork: string | null; payoutNumber: string | null; payoutName: string | null; job: { title: string; unit: string; kind: JobKind; payRate: number; payUnit: JobPayUnit; hoursPerWeek: number }; timesheets: Sheet[] }

/** Students: paid work, monthly timesheets, payout number, payslips. */
export function MyWork() {
  const [hires, setHires] = useState<Hire[] | null>(null);
  const [editing, setEditing] = useState<{ hire: Hire; sheet: Sheet } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<Hire[]>('/me/timesheets').then((r) => setHires(r.data)).catch(() => setHires([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!hires) return <Spinner />;
  if (!hires.length) return <EmptyState title="No paid work yet" description="When you are taken on for a paid job or assistantship, your timesheets are kept here." />;
  const month = new Date().toISOString().slice(0, 7);
  const openMonth = (h: Hire, period: string) => api.post<Sheet>(`/me/timesheets/jobs/${h.id}/open`, { period }).then((r) => setEditing({ hire: h, sheet: r.data })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  if (editing) return <SheetEditor hire={editing.hire} sheet={editing.sheet} onClose={() => { setEditing(null); load(); }} />;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {hires.map((h) => (
        <Card key={h.id}>
          <CardHeader title={`${h.job.title}, ${h.job.unit}`} description={`${JOB_KIND_LABEL[h.job.kind]}. ${formatCedis(h.job.payRate)} ${PAY_UNIT_LABEL[h.job.payUnit]}${h.job.payUnit === 'HOUR' ? `, up to ${h.job.hoursPerWeek} hours a week` : ''}.`} actions={h.status === 'HIRED' && <Button size="sm" onClick={() => openMonth(h, month)}>{h.job.payUnit === 'MONTH' ? 'Confirm this month' : 'This month\u2019s timesheet'}</Button>} />
          <CardBody className="flex flex-col gap-3">
            <PayoutForm hire={h} onSaved={() => { setMsg({ tone: 'success', text: 'Payout number saved.' }); load(); }} />
            {h.timesheets.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {h.timesheets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>{t.period}: {formatCedis(t.amount)}{t.returnNote ? <span className="block text-xs text-warning">{t.returnNote}</span> : null}</span>
                    <span className="flex items-center gap-2"><Badge tone={t.status === 'PAID' ? 'success' : t.status === 'RETURNED' ? 'danger' : t.status === 'DRAFT' ? 'neutral' : 'warning'}>{TIMESHEET_STATUS_LABEL[t.status]}</Badge>{(t.status === 'DRAFT' || t.status === 'RETURNED') && <Button variant="ghost" size="sm" onClick={() => setEditing({ hire: h, sheet: t })}>Edit</Button>}<a className="text-xs text-primary hover:underline" href={payslip(t.id)} download>{t.status === 'PAID' ? 'Payslip' : 'PDF'}</a></span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function PayoutForm({ hire, onSaved }: { hire: Hire; onSaved: () => void }) {
  const [f, setF] = useState({ network: hire.payoutNetwork ?? 'MTN', number: hire.payoutNumber ?? '', name: hire.payoutName ?? '' });
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pay me by mobile money</span>
      {!hire.payoutNumber && <p className="text-xs text-warning">Add your number so Finance can pay you.</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Select aria-label="Network" value={f.network} onChange={(e) => setF({ ...f, network: e.target.value })}><option value="MTN">MTN MoMo</option><option value="Telecel">Telecel Cash</option><option value="AirtelTigo">AirtelTigo Money</option></Select>
        <Input aria-label="Mobile money number" value={f.number} placeholder="0244000000" onChange={(e) => setF({ ...f, number: e.target.value })} />
        <Input aria-label="Name on the account" value={f.name} placeholder="Name on the account" onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Button size="sm" variant="secondary" disabled={f.number.trim().length < 9 || f.name.trim().length < 3} onClick={() => api.post(`/me/timesheets/jobs/${hire.id}/payout`, f).then(onSaved).catch((err) => setError(errorMessage(err)))}>Save</Button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

function SheetEditor({ hire, sheet, onClose }: { hire: Hire; sheet: Sheet; onClose: () => void }) {
  const [rows, setRows] = useState(sheet.entries.map((e) => ({ date: e.date, quantity: String(e.quantity), note: e.note ?? '' })));
  const [note, setNote] = useState(sheet.note ?? '');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const hourly = hire.job.payUnit === 'HOUR';
  const monthly = hire.job.payUnit === 'MONTH';
  const total = rows.reduce((t, r) => t + (Number(r.quantity) || 0), 0);
  const amount = monthly ? hire.job.payRate : Math.round(total * hire.job.payRate);
  const save = () => api.put<Sheet>(`/me/timesheets/${sheet.id}`, { entries: rows.filter((r) => r.date && Number(r.quantity) > 0).map((r) => ({ date: r.date, quantity: Number(r.quantity), note: r.note.trim() || undefined })), note: note.trim() || undefined });
  const submit = async () => {
    setMsg(null);
    try { await save(); await api.post(`/me/timesheets/${sheet.id}/submit`); onClose(); } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  return (
    <Card>
      <CardHeader title={`${hire.job.title}: ${sheet.period}`} description={monthly ? 'A monthly job: confirm the month and send it to your supervisor.' : hourly ? `Log each day you worked, in quarter hours. Up to ${hire.job.hoursPerWeek} hours a week on this job, and 20 across all your jobs.` : 'Log each task you completed.'} actions={<Button variant="ghost" size="sm" onClick={onClose}>Back</Button>} />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {sheet.returnNote && <Alert tone="warning">Returned: {sheet.returnNote}</Alert>}
        {!monthly && (
          <>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[10rem_7rem_1fr_auto]">
                <Input aria-label="Date" type="date" value={r.date} min={`${sheet.period}-01`} max={`${sheet.period}-31`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                <Input aria-label={hourly ? 'Hours' : 'Tasks'} type="number" step={hourly ? '0.25' : '1'} min={0} value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                <Input aria-label="What you did" placeholder="What you did" value={r.note} maxLength={200} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                <Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <div><Button variant="secondary" size="sm" onClick={() => setRows([...rows, { date: '', quantity: hourly ? '2' : '1', note: '' }])}>Add a day</Button></div>
          </>
        )}
        <Field label="Note to your supervisor (optional)" htmlFor="ts-n"><Input id="ts-n" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-sm">{monthly ? '' : `${total} ${hourly ? 'hours' : 'tasks'}. `}<span className="font-semibold">{formatCedis(amount)}</span></p>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => save().then(() => setMsg({ tone: 'success', text: 'Saved.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }))}>Save</Button><Button onClick={submit}>Send to supervisor</Button></div>
      </CardBody>
    </Card>
  );
}

/** Finance and HR: approved timesheets to pay. */
export function Payroll() {
  const [status, setStatus] = useState<'APPROVED' | 'PAID'>('APPROVED');
  const [rows, setRows] = useState<Sheet[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { setRows(null); api.get<Sheet[]>('/payroll', { params: { status } }).then((r) => setRows(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [status]);
  useEffect(() => { load(); }, [load]);
  const byHand = (t: Sheet) => { const ref = window.prompt('Transaction ID or payroll reference for this payment'); if (ref && ref.trim().length >= 3) api.post(`/payroll/${t.id}/paid`, { reference: ref.trim() }).then(() => { setMsg({ tone: 'success', text: 'Recorded as paid; the student has been told.' }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); };
  const total = (rows ?? []).reduce((t, r) => t + r.amount, 0);
  return (
    <Card>
      <CardHeader title={status === 'APPROVED' ? `To pay: ${formatCedis(total)}` : 'Paid'} description="Timesheets approved by supervisors. Pay by Paystack (to the student's mobile money number) or record a payment made another way." actions={<Select aria-label="Show" className="w-40" value={status} onChange={(e) => setStatus(e.target.value as 'APPROVED')}><option value="APPROVED">To pay</option><option value="PAID">Paid</option></Select>} />
      {msg && <div className="px-4 pb-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {!rows ? <CardBody><Spinner /></CardBody> : rows.length === 0 ? <CardBody><EmptyState title="Nothing here" /></CardBody> : (
        <ul className="divide-y divide-border">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{t.application.student.firstName} {t.application.student.lastName}</span> <span className="text-muted">{t.application.student.indexNumber}, {t.application.job.title}, {t.period}.</span><span className="block text-xs text-muted">{t.application.payoutNumber ? `${t.application.payoutNetwork} ${t.application.payoutNumber}` : 'No payout number yet.'}{t.paidReference ? ` Paid ${formatDate(t.paidAt!)}, ${t.paidReference}.` : ''} <a className="text-primary hover:underline" href={payslip(t.id)} download>Payslip</a></span></span>
              <span className="flex items-start gap-2"><span className="font-medium tabular-nums">{formatCedis(t.amount)}</span>{status === 'APPROVED' && <><PayNowButton purpose="PAYROLL" subjectId={t.id} amount={t.amount} label={`${t.application.student.firstName} ${t.application.student.lastName}`} onDone={load} /><Button variant="secondary" size="sm" onClick={() => byHand(t)}>Paid another way</Button></>}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
