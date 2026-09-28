'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';

type Status = 'PRESENT' | 'LATE' | 'ABSENT';
interface Session { id: string; startsAt: string; durationMinutes: number; registerClosedAt: string | null; venue: { name: string } | null; offering: { course: { code: string; title: string } }; _count: { seats: number; attendance: number } }
interface Register {
  id: string; startsAt: string; durationMinutes: number; registerNote: string | null; registerClosedAt: string | null; venue: { name: string } | null; offering: { course: { code: string; title: string } };
  rows: Array<{ seatNumber: number; student: { id: string; firstName: string; lastName: string; indexNumber: string | null }; eligible: 'ELIGIBLE' | 'NOT_ELIGIBLE' | null; feeCleared: boolean; unpaidDues: string[]; attendance: { status: Status } | null }>;
}

/** The exam attendance register, for invigilators and the Exams Office. */
export function ExamRegister() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<Session[]>('/exams/register').then((r) => setSessions(r.data)).catch((err) => setError(errorMessage(err))); }, []);
  if (open) return <Sheet id={open} onBack={() => setOpen(null)} />;
  if (!sessions) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!sessions.length) return <EmptyState title="No papers to invigilate" description="Papers you are assigned to appear here once the timetable is published." />;
  return (
    <Card>
      <CardHeader title="Your papers" />
      <ul className="divide-y divide-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span><span className="font-medium">{s.offering.course.code} {s.offering.course.title}</span><span className="block text-xs text-muted">{formatDateTime(s.startsAt)}, {s.durationMinutes} min, {s.venue?.name ?? 'venue to be confirmed'}. {s._count.seats} seated, {s._count.attendance} marked.</span></span>
            <span className="flex items-center gap-2">{s.registerClosedAt && <Badge>closed</Badge>}<Button size="sm" onClick={() => setOpen(s.id)}>Open register</Button></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Sheet({ id, onBack }: { id: string; onBack: () => void }) {
  const [r, setR] = useState<Register | null>(null);
  const [index, setIndex] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<Register>(`/exams/register/${id}`).then((x) => setR(x.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [id]);
  useEffect(() => { load(); }, [load]);
  const mark = async (body: { studentId?: string; indexNumber?: string; status: Status }) => {
    setMsg(null);
    try {
      const x = (await api.post<{ seatNumber: number; name: string; status: Status }>(`/exams/register/${id}/mark`, body)).data;
      if (body.indexNumber) { setMsg({ tone: 'success', text: `Seat ${x.seatNumber}: ${x.name} marked ${x.status.toLowerCase()}.` }); setIndex(''); }
      load();
    } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); }
  };
  if (!r) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const closed = !!r.registerClosedAt;
  const marked = r.rows.filter((x) => x.attendance).length;
  return (
    <div className="flex flex-col gap-4">
      <div><Button variant="ghost" size="sm" onClick={onBack}>All papers</Button></div>
      <Card>
        <CardHeader title={`${r.offering.course.code} ${r.offering.course.title}`} description={`${formatDateTime(r.startsAt)}, ${r.durationMinutes} min, ${r.venue?.name ?? ''}. ${marked} of ${r.rows.length} marked.${closed ? ' Register closed.' : ''}`} actions={<Button variant="secondary" size="sm" onClick={() => window.print()}>Print</Button>} />
        <CardBody className="flex flex-col gap-3">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {!closed && (
            <form className="flex flex-wrap items-end gap-2 print:hidden" onSubmit={(e) => { e.preventDefault(); if (index.trim()) void mark({ indexNumber: index.trim(), status: 'PRESENT' }); }}>
              <Field label="Mark present by index number (type or scan)" htmlFor="rg-i"><Input id="rg-i" autoFocus value={index} onChange={(e) => setIndex(e.target.value)} /></Field>
              <Button type="submit" disabled={!index.trim()}>Present</Button>
            </form>
          )}
          <p className="text-xs text-muted">Flags are for your information: check the Exams Office's instructions for students marked not eligible. Unpaid departmental dues do not stop anyone sitting.</p>
        </CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-muted"><tr className="border-y border-border"><th className="px-4 py-2 font-medium">Seat</th><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Flags</th><th className="px-4 py-2 font-medium">Attendance</th></tr></thead>
            <tbody className="divide-y divide-border">
              {r.rows.map((x) => (
                <tr key={x.student.id}>
                  <td className="px-4 py-2 font-mono tabular-nums">{x.seatNumber}</td>
                  <td className="px-3 py-2">{x.student.firstName} {x.student.lastName}<span className="block text-xs text-muted">{x.student.indexNumber}</span></td>
                  <td className="px-3 py-2"><span className="flex flex-wrap gap-1">
                    {x.eligible === 'NOT_ELIGIBLE' && <Badge tone="danger">Not eligible</Badge>}
                    {!x.feeCleared && <Badge tone="warning">Fees not cleared</Badge>}
                    {x.unpaidDues.map((c) => <Badge key={c} tone="warning">{c} dues unpaid</Badge>)}
                  </span></td>
                  <td className="px-4 py-2">
                    {closed || x.attendance ? <Badge tone={x.attendance?.status === 'ABSENT' ? 'danger' : x.attendance?.status === 'LATE' ? 'warning' : 'success'}>{x.attendance?.status.toLowerCase() ?? 'not marked'}</Badge> : null}
                    {!closed && (
                      <span className="ml-2 inline-flex gap-1 print:hidden">
                        {(['PRESENT', 'LATE', 'ABSENT'] as Status[]).map((st) => <Button key={st} size="sm" variant={x.attendance?.status === st ? 'primary' : 'ghost'} onClick={() => mark({ studentId: x.student.id, status: st })}>{st === 'PRESENT' ? 'Present' : st === 'LATE' ? 'Late' : 'Absent'}</Button>)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {!closed && (
        <Card>
          <CardHeader title="Close the register" description="At the end of the paper. Anyone not marked is recorded absent. Note any incidents." />
          <CardBody className="flex flex-col gap-3">
            <Field label="Incidents or remarks (optional)" htmlFor="rg-n"><Textarea id="rg-n" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
            <div><Button variant="danger" onClick={() => api.post<{ absent: number }>(`/exams/register/${id}/close`, { note: note.trim() || undefined }).then((x) => { setMsg({ tone: 'success', text: `Register closed. ${x.data.absent} recorded absent.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }))}>Close register</Button></div>
          </CardBody>
        </Card>
      )}
      {r.registerNote && <Alert tone="info">Remarks: {r.registerNote}</Alert>}
    </div>
  );
}
