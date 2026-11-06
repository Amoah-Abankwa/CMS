'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { downloadCsv } from '@/lib/csv';
import { formatDate } from '@/lib/format';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { academicsApi, type Semester } from '@/features/academics/api';

type Student = { firstName: string; lastName: string; indexNumber: string | null; studentProfile?: { currentLevel?: number; programme: { name: string } } | null };
interface Drop { id: string; reason: string; status: string; decisionNote: string | null; decidedAt: string | null; createdAt: string; student: Student & { id?: string }; offering: { id: string; course: { code: string; title: string; creditHours: number } } }
interface Rejected { id: string; reviewNote: string | null; reviewedAt: string | null; reviewedBy: { firstName: string; lastName: string } | null; student: Student; courses: string; credits: number }
interface Malpractice { id: string; occurredOn: string; offence: string; sanction: string | null; student: Student; offering: { course: { code: string; title: string } } | null }
const name = (s: Student) => `${s.firstName} ${s.lastName}`;

function useSemesters() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState('');
  useEffect(() => { academicsApi.semesters().then((x) => { setSemesters(x); setSemesterId((x.find((s) => s.isCurrent) ?? x[0])?.id ?? ''); }).catch(() => undefined); }, []);
  return { semesters, semesterId, setSemesterId };
}

/** Approvers: students' requests to drop a course. */
export function CourseDropRequests() {
  const { semesters, semesterId, setSemesterId } = useSemesters();
  const [rows, setRows] = useState<Drop[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { if (semesterId) api.get<Drop[]>('/course-drops', { params: { semesterId } }).then((r) => setRows(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [semesterId]);
  useEffect(() => { load(); }, [load]);
  const decide = (d: Drop, approve: boolean) => {
    const note = approve ? undefined : window.prompt('Why is it not approved? (the student sees this)') ?? '';
    if (!approve && !note) return;
    api.post(`/course-drops/${d.id}/decide`, { approve, note }).then(() => { setMsg({ tone: 'success', text: approve ? `${d.offering.course.code} dropped for ${name(d.student)}.` : 'Request not approved; the student has been told.' }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  };
  return (
    <div className="flex flex-col gap-4">
      <SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} id="cd-sem" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!rows ? <Spinner /> : rows.length === 0 ? <EmptyState title="No requests waiting" /> : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span><span className="font-medium">{name(d.student)}</span> <span className="text-muted">{d.student.indexNumber}, {d.student.studentProfile?.programme.name}</span><span className="block">Drop <span className="font-mono">{d.offering.course.code}</span> {d.offering.course.title} ({d.offering.course.creditHours} credits)</span><span className="block text-xs text-muted">{formatDate(d.createdAt)}: {d.reason}</span></span>
                <span className="flex gap-2"><Button size="sm" onClick={() => decide(d, true)}>Approve</Button><Button size="sm" variant="ghost" onClick={() => decide(d, false)}>Reject</Button></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type Tab = 'dropped' | 'rejected-registrations' | 'rejected-drops' | 'malpractice';
const TABS: Array<[Tab, string]> = [['dropped', 'Dropped courses'], ['rejected-registrations', 'Rejected registrations'], ['rejected-drops', 'Rejected drop requests'], ['malpractice', 'Malpractice']];

/** Registrar, Heads of Department (their department) and Registration Officers: registration records. */
export function RegistrationRecords() {
  const { semesters, semesterId, setSemesterId } = useSemesters();
  const [tab, setTab] = useState<Tab>('dropped');
  const [data, setData] = useState<{ semester: string; rows: Array<Drop | Rejected | Malpractice> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (semesterId) { setData(null); api.get(`/registration-records/${tab}`, { params: { semesterId } }).then((r) => setData(r.data)).catch((err) => setError(errorMessage(err))); } }, [tab, semesterId]);
  const exportCsv = () => {
    if (!data) return;
    const file = `${tab}-${data.semester.replace(/[^\w]+/g, '-')}.csv`;
    if (tab === 'rejected-registrations') downloadCsv(file, [['Index number', 'Student', 'Programme', 'Courses', 'Credits', 'Rejected on', 'By', 'Reason'], ...(data.rows as Rejected[]).map((r) => [r.student.indexNumber, name(r.student), r.student.studentProfile?.programme.name ?? '', r.courses, r.credits, r.reviewedAt ? r.reviewedAt.slice(0, 10) : '', r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : '', r.reviewNote ?? ''])]);
    else if (tab === 'malpractice') downloadCsv(file, [['Date', 'Index number', 'Student', 'Programme', 'Course', 'Offence', 'Sanction'], ...(data.rows as Malpractice[]).map((r) => [r.occurredOn.slice(0, 10), r.student.indexNumber, name(r.student), r.student.studentProfile?.programme.name ?? '', r.offering?.course.code ?? '', r.offence, r.sanction ?? ''])]);
    else downloadCsv(file, [['Index number', 'Student', 'Programme', 'Course', 'Credits', 'Asked on', 'Reason', 'Decided on', 'Note'], ...(data.rows as Drop[]).map((r) => [r.student.indexNumber, name(r.student), r.student.studentProfile?.programme.name ?? '', r.offering.course.code, r.offering.course.creditHours, r.createdAt.slice(0, 10), r.reason, r.decidedAt ? r.decidedAt.slice(0, 10) : '', r.decisionNote ?? ''])]);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} id="rr-sem" />
        <Button variant="secondary" size="sm" disabled={!data?.rows.length} onClick={exportCsv}>Export to CSV</Button>
      </div>
      <div role="tablist" aria-label="Records" className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md border px-3 py-1.5 text-sm', tab === k ? 'border-primary bg-primary text-white' : 'border-border hover:bg-surface-muted')}>{label}</button>)}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? <Spinner /> : data.rows.length === 0 ? <EmptyState title="Nothing for this semester" /> : (
        <Card>
          <ul className="divide-y divide-border">
            {data.rows.map((row) => {
              if (tab === 'rejected-registrations') { const r = row as Rejected; return <li key={r.id} className="px-4 py-3 text-sm sm:px-5"><span className="font-medium">{name(r.student)}</span> <span className="text-muted">{r.student.indexNumber}, {r.student.studentProfile?.programme.name}</span><span className="block">{r.courses} ({r.credits} credits)</span><span className="block text-xs text-muted">Rejected {r.reviewedAt ? formatDate(r.reviewedAt) : ''}{r.reviewedBy ? ` by ${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : ''}: {r.reviewNote}</span></li>; }
              if (tab === 'malpractice') { const r = row as Malpractice; return <li key={r.id} className="px-4 py-3 text-sm sm:px-5"><span className="font-medium">{name(r.student)}</span> <span className="text-muted">{r.student.indexNumber}, {r.student.studentProfile?.programme.name}. {formatDate(r.occurredOn)}{r.offering ? `, ${r.offering.course.code}` : ''}</span><span className="block">{r.offence}</span>{r.sanction && <span className="block text-xs">Sanction: {r.sanction}</span>}</li>; }
              const r = row as Drop;
              return <li key={r.id} className="px-4 py-3 text-sm sm:px-5"><span className="font-medium">{name(r.student)}</span> <span className="text-muted">{r.student.indexNumber}, {r.student.studentProfile?.programme.name}</span><span className="block"><span className="font-mono">{r.offering.course.code}</span> {r.offering.course.title}</span><span className="block text-xs text-muted">Asked {formatDate(r.createdAt)}: {r.reason}.{r.decidedAt ? ` Decided ${formatDate(r.decidedAt)}` : ''}{r.decisionNote ? `: ${r.decisionNote}` : ''}</span></li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** The Exams Office records exam malpractice cases. */
export function MalpracticeDesk() {
  const { semesters, semesterId, setSemesterId } = useSemesters();
  const [rows, setRows] = useState<Malpractice[] | null>(null);
  const [f, setF] = useState({ indexNumber: '', courseCode: '', occurredOn: new Date().toISOString().slice(0, 10), offence: '', sanction: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { if (semesterId) api.get<{ rows: Malpractice[] }>('/malpractice', { params: { semesterId } }).then((r) => setRows(r.data.rows)).catch(() => setRows([])); }, [semesterId]);
  useEffect(() => { load(); }, [load]);
  const save = () => api.post('/malpractice', { ...f, semesterId, courseCode: f.courseCode || undefined, sanction: f.sanction || undefined })
    .then(() => { setMsg({ tone: 'success', text: 'Case recorded.' }); setF({ ...f, indexNumber: '', courseCode: '', offence: '', sanction: '' }); load(); })
    .catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <div className="flex flex-col gap-4">
      <SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} id="mp-sem" />
      <Card>
        <CardHeader title="Record a case" description="Seen by the Registrar, the student's Head of Department and Registration Officers." />
        <CardBody className="flex flex-col gap-3">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Index number" htmlFor="mp-i"><Input id="mp-i" value={f.indexNumber} onChange={(e) => setF({ ...f, indexNumber: e.target.value })} /></Field>
            <Field label="Course (optional)" htmlFor="mp-c"><Input id="mp-c" value={f.courseCode} placeholder="CSC 201" onChange={(e) => setF({ ...f, courseCode: e.target.value })} /></Field>
            <Field label="Date" htmlFor="mp-d"><Input id="mp-d" type="date" value={f.occurredOn} onChange={(e) => setF({ ...f, occurredOn: e.target.value })} /></Field>
          </div>
          <Field label="What happened" htmlFor="mp-o"><Textarea id="mp-o" value={f.offence} maxLength={2000} onChange={(e) => setF({ ...f, offence: e.target.value })} /></Field>
          <Field label="Sanction (optional, can be added later)" htmlFor="mp-s"><Input id="mp-s" value={f.sanction} maxLength={1000} onChange={(e) => setF({ ...f, sanction: e.target.value })} /></Field>
          <div><Button disabled={f.indexNumber.trim().length < 6 || f.offence.trim().length < 5} onClick={save}>Record case</Button></div>
        </CardBody>
      </Card>
      {rows && rows.length > 0 && (
        <Card>
          <CardHeader title={`Cases (${rows.length})`} />
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <span><span className="font-medium">{name(r.student)}</span> <span className="text-muted">{r.student.indexNumber}. {formatDate(r.occurredOn)}{r.offering ? `, ${r.offering.course.code}` : ''}</span><span className="block">{r.offence}</span>{r.sanction && <span className="block text-xs">Sanction: {r.sanction}</span>}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { const s = window.prompt('Sanction', r.sanction ?? ''); if (s === null) return; api.patch(`/malpractice/${r.id}`, { indexNumber: r.student.indexNumber, courseCode: r.offering?.course.code, occurredOn: r.occurredOn.slice(0, 10), offence: r.offence, sanction: s.trim() || undefined, semesterId }).then(load).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }}>Sanction</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Delete this case? Only for one recorded by mistake.')) api.delete(`/malpractice/${r.id}`).then(load); }}>Delete</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
