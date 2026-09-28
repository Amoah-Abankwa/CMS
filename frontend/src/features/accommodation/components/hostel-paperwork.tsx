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
import { formatDate, formatDateTime } from '@/lib/format';
import { documentHref, uploadDocument } from '@/components/ui/document-upload';
import { accommodationApi } from '../api';

const STATUS = { SUBMITTED: { label: 'Waiting for review', tone: 'warning' }, ACCEPTED: { label: 'Accepted', tone: 'success' }, RETURNED: { label: 'Returned', tone: 'danger' } } as const;
type SubStatus = keyof typeof STATUS;

function FileButton({ label, busy, onFile }: { label: string; busy?: boolean; onFile: (f: File) => void }) {
  return (
    <label className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
      {busy ? 'Uploading…' : label}
      <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}
const uploadError = (err: unknown) => (err instanceof Error && !('response' in err) ? err.message : errorMessage(err));

/** Student: forms for their hostel to download, sign and upload back. */
export function MyHostelForms() {
  const [forms, setForms] = useState<Array<{ id: string; title: string; description: string | null; documentId: string; hostelName: string; submission: { status: SubStatus; note: string | null; documentId: string; updatedAt: string } | null }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get('/hostel-forms/mine').then((r) => setForms(r.data.forms)).catch(() => setForms([])); }, []);
  useEffect(() => { load(); }, [load]);
  if (!forms || !forms.length) return null;
  const send = async (templateId: string, file: File) => {
    setBusy(templateId);
    setMsg(null);
    try {
      const doc = await uploadDocument('HOSTEL_FORM_SUBMISSION', file, templateId);
      await api.post(`/hostel-forms/${templateId}/submit`, { documentId: doc.id });
      setMsg({ tone: 'success', text: 'Signed form sent to the hostel.' });
      load();
    } catch (err) { setMsg({ tone: 'danger', text: uploadError(err) }); } finally { setBusy(null); }
  };
  return (
    <Card>
      <CardHeader title="Hostel forms" description="Download each form, fill it in and sign it, then upload a scan or photo of the signed copy." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {forms.map((f) => (
          <div key={f.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{f.title} <span className="font-normal text-muted">{f.hostelName}</span></span>{f.submission ? <Badge tone={STATUS[f.submission.status].tone}>{STATUS[f.submission.status].label}</Badge> : <Badge>Not sent</Badge>}</div>
            {f.description && <p className="text-muted">{f.description}</p>}
            {f.submission?.status === 'RETURNED' && f.submission.note && <Alert tone="warning">{f.submission.note}</Alert>}
            <div className="flex flex-wrap items-center gap-3">
              <a className="text-primary hover:underline" href={documentHref(f.documentId)}>Download the form</a>
              {f.submission && <a className="text-primary hover:underline" href={documentHref(f.submission.documentId)}>Your signed copy</a>}
              {f.submission?.status !== 'ACCEPTED' && <FileButton label={f.submission ? 'Upload again' : 'Upload signed form'} busy={busy === f.id} onFile={(file) => send(f.id, file)} />}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

interface Resident {
  kind: 'allocation' | 'booking'; id: string; hostel: string; place: string;
  student: { id: string; firstName: string; lastName: string; indexNumber: string | null; phone: string | null };
  checkedInAt: string | null; checkInNote: string | null; checkedOutAt: string | null; checkOutNote: string | null;
  forms: Array<{ id: string; status: SubStatus; note: string | null; documentId: string; template: { title: string } }>;
}

/** Hostel Manager (halls) or owner (private hostels): residents, check-in and check-out, forms. */
export function HostelResidents() {
  const [data, setData] = useState<Resident[] | null>(null);
  const [filter, setFilter] = useState('');
  const [dlg, setDlg] = useState<{ r: Resident; action: 'in' | 'out' } | { formId: string; name: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<{ residents: Resident[] }>('/hostel-forms/residents').then((r) => setData(r.data.residents)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const shown = data.filter((r) => !filter || `${r.student.indexNumber} ${r.student.firstName} ${r.student.lastName} ${r.hostel} ${r.place}`.toLowerCase().includes(filter.toLowerCase()));
  const inCount = data.filter((r) => r.checkedInAt && !r.checkedOutAt).length;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <p className="text-sm text-muted">{data.length} residents this semester; {inCount} checked in now.</p>
      <Input aria-label="Find a resident" className="w-72" placeholder="Name, index number, room" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {shown.length === 0 ? <EmptyState title="No residents" /> : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{r.student.firstName} {r.student.lastName}</span> <span className="text-muted">{r.student.indexNumber}, {r.hostel}, {r.place}. {r.student.phone ?? ''}</span></span>
                  <span className="flex flex-wrap items-center gap-2">
                    {r.checkedOutAt ? <Badge>Checked out {formatDate(r.checkedOutAt)}</Badge> : r.checkedInAt ? <Badge tone="success">In since {formatDate(r.checkedInAt)}</Badge> : <Badge tone="warning">Not checked in</Badge>}
                    {!r.checkedInAt && <Button size="sm" onClick={() => setDlg({ r, action: 'in' })}>Check in</Button>}
                    {r.checkedInAt && !r.checkedOutAt && <Button size="sm" variant="secondary" onClick={() => setDlg({ r, action: 'out' })}>Check out</Button>}
                  </span>
                </div>
                {(r.checkInNote || r.checkOutNote) && <p className="text-xs text-muted">{r.checkInNote ? `In: ${r.checkInNote}. ` : ''}{r.checkOutNote ? `Out: ${r.checkOutNote}.` : ''}</p>}
                {r.forms.length > 0 && (
                  <span className="flex flex-wrap gap-3 text-xs">
                    {r.forms.map((f) => (
                      <span key={f.id} className="flex items-center gap-2">
                        <a className="text-primary hover:underline" href={documentHref(f.documentId)}>{f.template.title}</a>
                        <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>
                        {f.status === 'SUBMITTED' && (
                          <>
                            <button className="text-primary hover:underline" onClick={() => api.post(`/hostel-forms/submissions/${f.id}/review`, { accept: true }).then(() => { setMsg({ tone: 'success', text: 'Form accepted.' }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }))}>accept</button>
                            <button className="text-muted hover:underline" onClick={() => setDlg({ formId: f.id, name: `${r.student.firstName}'s ${f.template.title}` })}>return</button>
                          </>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {dlg && <NoteDialog dlg={dlg} onClose={() => setDlg(null)} onDone={(t) => { setDlg(null); setMsg({ tone: 'success', text: t }); load(); }} />}
      <FormTemplates />
    </div>
  );
}

function NoteDialog({ dlg, onClose, onDone }: { dlg: { r: Resident; action: 'in' | 'out' } | { formId: string; name: string }; onClose: () => void; onDone: (t: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const check = 'r' in dlg;
  const submit = () => (check
    ? api.post(`/hostel-forms/residents/${dlg.r.kind}/${dlg.r.id}/check`, { action: dlg.action, note: note.trim() || undefined }).then(() => onDone(dlg.action === 'in' ? 'Checked in.' : 'Checked out.'))
    : api.post(`/hostel-forms/submissions/${dlg.formId}/review`, { accept: false, note: note.trim() }).then(() => onDone('Returned to the student with your note.'))).catch((err) => setError(errorMessage(err)));
  return (
    <Dialog open onClose={onClose} title={check ? `Check ${dlg.action} ${dlg.r.student.firstName} ${dlg.r.student.lastName}` : `Return ${dlg.name}`} description={check ? `${dlg.r.hostel}, ${dlg.r.place}. ${formatDateTime(new Date())}.` : 'Tell the student what to correct; they upload it again.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={check ? 'Note (optional): keys, room condition, items' : 'What to correct'} htmlFor="nd-n"><Textarea id="nd-n" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!check && note.trim().length < 3} onClick={submit}>{check ? `Check ${dlg.action}` : 'Return'}</Button></div>
      </div>
    </Dialog>
  );
}

function FormTemplates() {
  const [list, setList] = useState<Array<{ id: string; title: string; description: string | null; isActive: boolean; documentId: string; hostel: { id: string; name: string } | null; _count: { submissions: number } }> | null>(null);
  const [hostels, setHostels] = useState<Array<{ id: string; name: string; kind?: string }>>([]);
  const [f, setF] = useState({ title: '', description: '', hostelId: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get('/hostel-forms/templates').then((r) => setList(r.data)).catch(() => setList([])); }, []);
  useEffect(() => {
    load();
    Promise.all([accommodationApi.myHostels().catch(() => []), api.get('/hostels').then((r) => r.data).catch(() => [])]).then(([mine, halls]) => setHostels([...(mine as Array<{ id: string; name: string }>), ...((Array.isArray(halls) ? halls : halls?.items ?? []) as Array<{ id: string; name: string }>)]));
  }, [load]);
  if (!list) return null;
  const add = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const doc = await uploadDocument('HOSTEL_FORM', file, f.hostelId || 'university');
      await api.post('/hostel-forms/templates', { title: f.title.trim(), description: f.description.trim() || undefined, hostelId: f.hostelId || null, documentId: doc.id });
      setF({ title: '', description: '', hostelId: f.hostelId });
      setMsg({ tone: 'success', text: 'Form added. Students placed in that hostel see it.' });
      load();
    } catch (err) { setMsg({ tone: 'danger', text: uploadError(err) }); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader title="Forms students must return" description="Tenancy agreement, registration form and so on. Upload a blank copy; students download it, sign and upload it back." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Title" htmlFor="ft-t"><Input id="ft-t" value={f.title} maxLength={100} placeholder="Tenancy agreement" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="For" htmlFor="ft-h"><Select id="ft-h" value={f.hostelId} onChange={(e) => setF({ ...f, hostelId: e.target.value })}><option value="">Every university hall</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></Field>
          <Field label="Note to students (optional)" htmlFor="ft-d"><Input id="ft-d" value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        {f.title.trim().length >= 3 ? <FileButton label="Upload the blank form" busy={busy} onFile={add} /> : <p className="text-xs text-muted">Enter a title, then upload the form (PDF, JPG or PNG).</p>}
        {list.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {list.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><a className="text-primary hover:underline" href={documentHref(t.documentId)}>{t.title}</a> <span className="text-muted">{t.hostel?.name ?? 'Every university hall'}, {t._count.submissions} returned</span> {!t.isActive && <Badge>not in use</Badge>}</span>
                <Button variant="ghost" size="sm" onClick={() => api.post(`/hostel-forms/templates/${t.id}/active`, { isActive: !t.isActive }).then(load)}>{t.isActive ? 'Stop using' : 'Use again'}</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
