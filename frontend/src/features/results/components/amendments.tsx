'use client';

import { useCallback, useEffect, useState } from 'react';
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

type Snap = { caScore: number; examScore: number; total: number; grade: string };
interface Amendment {
  id: string; reason: string; before: Snap; newCaScore: number; newExamScore: number; after: Snap | null; status: string; requestedAt: string; rejectNote: string | null; waitingFor: string | null; canAct: boolean;
  result: { student: { firstName: string; lastName: string; indexNumber: string | null }; sheet: { offering: { course: { code: string; title: string }; semester: { number: number; academicYear: { label: string } } } } };
}
interface Amendable {
  id: string; caScore: number; examScore: number; total: number; grade: string; incomplete: boolean;
  student: { firstName: string; lastName: string; indexNumber: string | null };
  sheet: { offering: { course: { code: string; title: string }; semester: { number: number; academicYear: { label: string } } } };
  amendments: Array<{ id: string }>;
}
const STATUS: Record<string, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  REQUESTED: { label: 'Waiting for Head of Department', tone: 'warning' }, HOD_APPROVED: { label: 'Waiting for Dean', tone: 'warning' }, DEAN_APPROVED: { label: 'Waiting to be applied', tone: 'primary' },
  APPLIED: { label: 'Applied', tone: 'success' }, REJECTED: { label: 'Rejected', tone: 'danger' },
};

/** Corrections to published results, with the full approval trail. */
export function Amendments() {
  const [list, setList] = useState<Amendment[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [q, setQ] = useState({ indexNumber: '', courseCode: '' });
  const [found, setFound] = useState<Amendable[] | null>(null);
  const [editing, setEditing] = useState<Amendable | null>(null);
  const [rejecting, setRejecting] = useState<Amendment | null>(null);
  const load = useCallback(() => { api.get<Amendment[]>('/results/amendments').then((r) => setList(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  const search = () => api.get<Amendable[]>('/results/amendments/amendable', { params: q }).then((r) => setFound(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  const act = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ tone: 'success', text: ok }); load(); } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); } };

  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Request an amendment" description="For a published result: find the student, enter the corrected scores and the reason. It then goes to the Head of Department, the Dean, and the Exams Office or Registrar." />
        <CardBody className="flex flex-col gap-3">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <Field label="Index number" htmlFor="am-i"><Input id="am-i" value={q.indexNumber} onChange={(e) => setQ({ ...q, indexNumber: e.target.value })} /></Field>
            <Field label="Course code" htmlFor="am-c"><Input id="am-c" value={q.courseCode} placeholder="CSC 101" onChange={(e) => setQ({ ...q, courseCode: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" variant="secondary" disabled={!q.indexNumber.trim() && !q.courseCode.trim()}>Find</Button></div>
          </form>
          {found && (found.length === 0 ? <p className="text-sm text-muted">No published results found for courses you can amend.</p> : (
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {found.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{r.student.firstName} {r.student.lastName} <span className="text-muted">{r.student.indexNumber}. {r.sheet.offering.course.code}, {r.sheet.offering.semester.academicYear.label} S{r.sheet.offering.semester.number}. {r.grade} ({r.total}): CA {r.caScore}, exam {r.examScore}.</span></span>
                  {r.amendments.length ? <Badge tone="warning">Amendment pending</Badge> : <Button size="sm" onClick={() => setEditing(r)}>Amend</Button>}
                </li>
              ))}
            </ul>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Amendments" />
        {!list ? <CardBody><Spinner /></CardBody> : list.length === 0 ? <CardBody><EmptyState title="No amendments" /></CardBody> : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span><span className="font-medium">{a.result.student.firstName} {a.result.student.lastName}</span> <span className="text-muted">{a.result.student.indexNumber}, {a.result.sheet.offering.course.code} {a.result.sheet.offering.course.title}</span>
                    <span className="block">From {a.before.grade} ({a.before.total}: CA {a.before.caScore}, exam {a.before.examScore}) to CA {a.newCaScore}, exam {a.newExamScore}{a.after ? `, now ${a.after.grade} (${a.after.total})` : ''}.</span>
                    <span className="block text-xs text-muted">Requested {formatDate(a.requestedAt)}. Reason: {a.reason}{a.rejectNote ? `. Rejected: ${a.rejectNote}` : ''}</span></span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone={STATUS[a.status]?.tone ?? 'neutral'}>{STATUS[a.status]?.label ?? a.status}</Badge>
                    {a.canAct && <Button size="sm" onClick={() => act(() => api.post(`/results/amendments/${a.id}/approve`), a.status === 'DEAN_APPROVED' ? 'Applied. The student has been told.' : 'Approved and passed on.')}>{a.status === 'DEAN_APPROVED' ? 'Apply' : 'Approve'}</Button>}
                    {a.canAct && <Button variant="ghost" size="sm" onClick={() => setRejecting(a)}>Reject</Button>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <RequestDialog r={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); setFound(null); setMsg({ tone: 'success', text: 'Amendment requested. It goes to the Head of Department first.' }); load(); }} />}
      {rejecting && <RejectDialog a={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); load(); }} />}
    </div>
  );
}

function RequestDialog({ r, onClose, onDone }: { r: Amendable; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ caScore: String(r.caScore), examScore: String(r.examScore), reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = Math.round(Number(f.caScore) + Number(f.examScore));
  const save = async () => {
    setBusy(true);
    try { await api.post('/results/amendments', { resultId: r.id, caScore: Number(f.caScore), examScore: Number(f.examScore), reason: f.reason.trim() }); onDone(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`Amend ${r.sheet.offering.course.code} for ${r.student.firstName} ${r.student.lastName}`} description={`Now ${r.grade} (${r.total}). Enter the weighted scores as they count towards the total.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Continuous assessment" htmlFor="rq-ca"><Input id="rq-ca" type="number" step="0.5" value={f.caScore} onChange={(e) => setF({ ...f, caScore: e.target.value })} /></Field>
          <Field label="Exam" htmlFor="rq-ex"><Input id="rq-ex" type="number" step="0.5" value={f.examScore} onChange={(e) => setF({ ...f, examScore: e.target.value })} /></Field>
        </div>
        <p className="text-sm">New total: <span className="font-semibold tabular-nums">{Number.isFinite(total) ? total : '-'}</span>. The grade is worked out on the scale the results were published with.</p>
        <Field label="Reason" htmlFor="rq-r" hint="For example: exam script remarked; a question was not added."><Textarea id="rq-r" value={f.reason} maxLength={500} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={f.reason.trim().length < 10 || !(total >= 0 && total <= 100)} onClick={save}>Request amendment</Button></div>
      </div>
    </Dialog>
  );
}

function RejectDialog({ a, onClose, onDone }: { a: Amendment; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title="Reject this amendment?">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" htmlFor="rj-n"><Textarea id="rj-n" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Back</Button><Button variant="danger" disabled={note.trim().length < 5} onClick={() => api.post(`/results/amendments/${a.id}/reject`, { note: note.trim() }).then(onDone).catch((err) => setError(errorMessage(err)))}>Reject</Button></div>
      </div>
    </Dialog>
  );
}
