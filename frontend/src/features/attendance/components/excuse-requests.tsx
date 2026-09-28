'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { documentHref, uploadDocument } from '@/components/ui/document-upload';

type Category = 'MEDICAL' | 'BEREAVEMENT' | 'OFFICIAL_DUTY' | 'OTHER';
const CATEGORY: Record<Category, string> = { MEDICAL: 'Illness (medical note needed)', BEREAVEMENT: 'Bereavement', OFFICIAL_DUTY: 'Official university duty', OTHER: 'Other' };
const STATUS = { REQUESTED: { label: 'Waiting', tone: 'warning' }, APPROVED: { label: 'Excused', tone: 'success' }, DECLINED: { label: 'Declined', tone: 'danger' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' } } as const;
interface Req { id: string; fromDate: string; toDate: string; category: Category; statement: string; status: keyof typeof STATUS; decisionNote: string | null; createdAt: string; document: { id: string; originalName: string } | null; student: { firstName: string; lastName: string; indexNumber: string | null } }

/** Students ask to be excused from classes and morning devotion, with evidence. */
export function MyExcuseRequests() {
  const [list, setList] = useState<Req[] | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ fromDate: today, toDate: today, category: 'MEDICAL' as Category, statement: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<Req[]>('/me/excuse-requests').then((r) => setList(r.data)).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const doc = file ? await uploadDocument('EXCUSE', file) : null;
      await api.post('/me/excuse-requests', { ...f, statement: f.statement.trim(), documentId: doc?.id });
      setMsg({ tone: 'success', text: 'Request sent. You will be told when it is decided.' });
      setF({ ...f, statement: '' });
      setFile(null);
      load();
    } catch (err) { setMsg({ tone: 'danger', text: err instanceof Error && !('response' in err) ? err.message : errorMessage(err) }); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Ask to be excused" description="If you are approved, your class attendance and morning devotion are corrected for those days. Your document is only seen by the staff who decide excuses." />
        <CardBody className="flex flex-col gap-3">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="From" htmlFor="ex-f"><Input id="ex-f" type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></Field>
            <Field label="To" htmlFor="ex-t"><Input id="ex-t" type="date" value={f.toDate} min={f.fromDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></Field>
            <Field label="Reason" htmlFor="ex-c"><Select id="ex-c" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY[c]}</option>)}</Select></Field>
          </div>
          <Field label="What happened" htmlFor="ex-s"><Textarea id="ex-s" value={f.statement} maxLength={1000} onChange={(e) => setF({ ...f, statement: e.target.value })} /></Field>
          <Field label={`Supporting document${f.category === 'MEDICAL' ? '' : ' (optional)'}`} htmlFor="ex-d" hint="PDF, JPG or PNG, up to 10 MB."><input id="ex-d" type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <div><Button loading={busy} disabled={f.statement.trim().length < 10 || (f.category === 'MEDICAL' && !file)} onClick={send}>Send request</Button></div>
        </CardBody>
      </Card>
      {list && list.length > 0 && (
        <Card>
          <CardHeader title="Your requests" />
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span>{formatDate(r.fromDate)} to {formatDate(r.toDate)}, {CATEGORY[r.category].split(' (')[0]}<span className="block text-xs text-muted">{r.decisionNote ?? ''}</span></span>
                <span className="flex items-center gap-2"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>{r.status === 'REQUESTED' && <Button variant="ghost" size="sm" onClick={() => api.post(`/me/excuse-requests/${r.id}/withdraw`).then(load)}>Withdraw</Button>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Health Centre and Dean of Students office: decide students' excuse requests. */
export function ExcuseRequestsReview() {
  const [status, setStatus] = useState('REQUESTED');
  const [list, setList] = useState<Req[] | null>(null);
  const [declining, setDeclining] = useState<Req | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { setList(null); api.get<Req[]>('/attendance/excuse-requests', { params: { status } }).then((r) => setList(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [status]);
  useEffect(() => { load(); }, [load]);
  const approve = (r: Req) => api.post(`/attendance/excuse-requests/${r.id}/decide`, { approve: true }).then(() => { setMsg({ tone: 'success', text: `${r.student.firstName} is excused; attendance and devotion are corrected.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <Card>
      <CardHeader title="Excuse requests from students" actions={<Select aria-label="Show" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="REQUESTED">Waiting</option><option value="APPROVED">Excused</option><option value="DECLINED">Declined</option></Select>} />
      {msg && <div className="px-4 pb-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {!list ? <CardBody><Spinner /></CardBody> : list.length === 0 ? <CardBody><EmptyState title="Nothing here" /></CardBody> : (
        <ul className="divide-y divide-border">
          {list.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span><span className="font-medium">{r.student.firstName} {r.student.lastName}</span> <span className="text-muted">{r.student.indexNumber}. {formatDate(r.fromDate)} to {formatDate(r.toDate)}, {CATEGORY[r.category].split(' (')[0]}.</span></span>
                {r.status === 'REQUESTED' ? <span className="flex gap-2"><Button size="sm" onClick={() => approve(r)}>Excuse</Button><Button variant="ghost" size="sm" onClick={() => setDeclining(r)}>Decline</Button></span> : <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}
              </div>
              <p className="rounded-md bg-surface-muted px-3 py-2">{r.statement}</p>
              {r.document ? <a className="text-primary hover:underline" href={documentHref(r.document.id)}>Open {r.document.originalName}</a> : <span className="text-xs text-muted">No document attached.</span>}
            </li>
          ))}
        </ul>
      )}
      {declining && <DeclineDialog r={declining} onClose={() => setDeclining(null)} onDone={() => { setDeclining(null); load(); }} />}
    </Card>
  );
}

function DeclineDialog({ r, onClose, onDone }: { r: Req; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title={`Decline ${r.student.firstName}'s request?`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason (the student sees it)" htmlFor="dc-n"><Textarea id="dc-n" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Back</Button><Button variant="danger" disabled={note.trim().length < 5} onClick={() => api.post(`/attendance/excuse-requests/${r.id}/decide`, { approve: false, note: note.trim() }).then(onDone).catch((err) => setError(errorMessage(err)))}>Decline</Button></div>
      </div>
    </Dialog>
  );
}
