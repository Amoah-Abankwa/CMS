'use client';

import { useCallback, useEffect, useState } from 'react';
import { ILL_STATUS_LABEL, type IllStatus } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { uploadDocument } from '@/components/ui/document-upload';
import { libraryApi } from '../api';

interface Clearance { clear: boolean; reasons: string[]; certificate: { certificateNumber: string; createdAt: string } | null }
interface ListItem { id: string; citation: string | null; url: string | null; importance: 'ESSENTIAL' | 'RECOMMENDED'; note: string | null; title: { id: string; title: string; authors: string[]; edition: string | null; callNumber: string | null; hasEbook: boolean } | null; availability: { total: number; available: number } | null }
interface ReadingList { id: string; updatedAt: string; course: { code: string; title: string }; items: ListItem[] }
interface Ill { id: string; title: string; authors: string | null; status: IllStatus; dueDate: string | null; librarianNote: string | null; createdAt: string; requester?: { firstName: string; lastName: string; indexNumber: string | null; phone: string | null } }
const readHref = (id: string) => `/api/v1/library/titles/${id}/read`;
const certHref = (n: string) => `/api/v1/library/clearance/${n}/pdf`;

function ItemLine({ i }: { i: ListItem }) {
  return (
    <li className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-start sm:justify-between">
      <span>
        {i.importance === 'ESSENTIAL' && <Badge tone="primary">Essential</Badge>}{' '}
        {i.title ? <><span className="font-medium">{i.title.title}</span>{i.title.authors.length ? `, ${i.title.authors.join(', ')}` : ''}{i.title.edition ? `, ${i.title.edition}` : ''}{i.title.callNumber ? <span className="text-muted">. {i.title.callNumber}</span> : null}</> : <span>{i.citation}</span>}
        {i.note && <span className="block text-xs text-muted">{i.note}</span>}
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
        {i.availability && <Badge tone={i.availability.available ? 'success' : 'warning'}>{i.availability.available} of {i.availability.total} on the shelf</Badge>}
        {i.title?.hasEbook && <a className="text-primary hover:underline" href={readHref(i.title.id)} target="_blank" rel="noreferrer">Read e-book</a>}
        {i.url && <a className="text-primary hover:underline" href={i.url} target="_blank" rel="noreferrer">Open link</a>}
      </span>
    </li>
  );
}

/** On the member's Library page: clearance, reading lists for their courses, inter-library loans. */
export function MyLibraryExtras() {
  const [clearance, setClearance] = useState<Clearance | null>(null);
  const [lists, setLists] = useState<ReadingList[] | null>(null);
  const [ill, setIll] = useState<Ill[] | null>(null);
  const [f, setF] = useState({ title: '', authors: '', isbn: '', neededBy: '', note: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const loadIll = useCallback(() => { api.get<Ill[]>('/me/library/ill').then((r) => setIll(r.data)).catch(() => setIll([])); }, []);
  useEffect(() => {
    api.get<Clearance>('/me/library/clearance').then((r) => setClearance(r.data)).catch(() => undefined);
    api.get<ReadingList[]>('/me/library/reading-lists').then((r) => setLists(r.data)).catch(() => setLists([]));
    loadIll();
  }, [loadIll]);
  const request = () => api.post('/me/library/ill', { title: f.title.trim(), authors: f.authors.trim() || undefined, isbn: f.isbn.trim() || undefined, neededBy: f.neededBy || undefined, note: f.note.trim() || undefined })
    .then(() => { setMsg({ tone: 'success', text: 'Request sent to the library. You will be told when it arrives.' }); setF({ title: '', authors: '', isbn: '', neededBy: '', note: '' }); loadIll(); })
    .catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <div className="flex flex-col gap-4">
      {lists && lists.length > 0 && (
        <Card>
          <CardHeader title="Reading lists for your courses" />
          <CardBody className="flex flex-col gap-4">
            {lists.map((l) => (
              <div key={l.id}><p className="text-sm font-semibold">{l.course.code} {l.course.title}</p><ul className="divide-y divide-border">{l.items.map((i) => <ItemLine key={i.id} i={i} />)}</ul></div>
            ))}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title="Inter-library loans" description="Ask the library to borrow a book it does not hold from another library." />
        <CardBody className="flex flex-col gap-3">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" htmlFor="il-t"><Input id="il-t" value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Author(s)" htmlFor="il-a"><Input id="il-a" value={f.authors} maxLength={200} onChange={(e) => setF({ ...f, authors: e.target.value })} /></Field>
            <Field label="ISBN (optional)" htmlFor="il-i"><Input id="il-i" value={f.isbn} maxLength={20} onChange={(e) => setF({ ...f, isbn: e.target.value })} /></Field>
            <Field label="Needed by (optional)" htmlFor="il-n"><Input id="il-n" type="date" value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} /></Field>
          </div>
          <Field label="Note (optional)" htmlFor="il-note"><Input id="il-note" value={f.note} maxLength={500} placeholder="Which library has it, which chapter you need..." onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <div><Button variant="secondary" disabled={f.title.trim().length < 2} onClick={request}>Request</Button></div>
          {ill && ill.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {ill.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{r.title}<span className="block text-xs text-muted">{r.dueDate ? `Due back ${formatDate(r.dueDate)}. ` : ''}{r.librarianNote ?? ''}</span></span>
                  <span className="flex items-center gap-2"><Badge tone={r.status === 'ARRIVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'neutral'}>{ILL_STATUS_LABEL[r.status]}</Badge>{r.status === 'REQUESTED' && <Button variant="ghost" size="sm" onClick={() => api.post(`/me/library/ill/${r.id}/cancel`).then(loadIll)}>Cancel</Button>}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {clearance && (
        <Card>
          <CardHeader title="Library clearance" description="Needed for graduation: every book returned and no fines owed." actions={clearance.clear ? <Badge tone="success">Clear</Badge> : <Badge tone="warning">Not yet clear</Badge>} />
          <CardBody className="text-sm">
            {clearance.clear ? (clearance.certificate ? <p>Certificate {clearance.certificate.certificateNumber}, issued {formatDate(clearance.certificate.createdAt)}. <a className="text-primary hover:underline" href={certHref(clearance.certificate.certificateNumber)} download>Download PDF</a></p> : <p>You are clear. When you need your certificate, the library desk issues it.</p>) : <ul className="list-disc pl-5">{clearance.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** Library desk and Registry: check a graduation list, issue certificates. */
export function ClearanceDesk() {
  const [text, setText] = useState('');
  const [data, setData] = useState<{ rows: Array<Clearance & { student: { id: string; firstName: string; lastName: string; indexNumber: string } }>; notFound: string[] } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const check = () => api.post('/library/clearance/check', { indexNumbers: text }).then((r) => setData(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  const issue = (index: string) => api.post('/library/clearance/issue', { indexNumber: index }).then(() => { setMsg({ tone: 'success', text: `Certificate issued for ${index}.` }); void check(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title="Check clearance" description="Paste one index number, or the whole graduation list. The Registry can check; library staff issue certificates." />
        <CardBody className="flex flex-col gap-3">
          <Textarea aria-label="Index numbers" value={text} onChange={(e) => setText(e.target.value)} placeholder="ANU22400001 ANU22400002 ..." />
          <div><Button disabled={!text.trim()} onClick={check}>Check</Button></div>
        </CardBody>
      </Card>
      {data && (
        <Card>
          <CardHeader title={`${data.rows.filter((r) => r.clear).length} of ${data.rows.length} clear`} description={data.notFound.length ? `Not found: ${data.notFound.join(', ')}` : undefined} />
          <ul className="divide-y divide-border">
            {data.rows.map((r) => (
              <li key={r.student.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span>{r.student.firstName} {r.student.lastName} <span className="text-muted">{r.student.indexNumber}</span>{!r.clear && <span className="block text-xs text-muted">{r.reasons.join(' ')}</span>}</span>
                <span className="flex items-center gap-2">
                  {r.certificate ? <a className="text-primary hover:underline" href={certHref(r.certificate.certificateNumber)} download>{r.certificate.certificateNumber}</a> : r.clear ? <Button size="sm" onClick={() => issue(r.student.indexNumber)}>Issue certificate</Button> : null}
                  <Badge tone={r.clear ? 'success' : 'warning'}>{r.clear ? 'Clear' : 'Not clear'}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Library desk: inter-library loan requests through to return. */
export function IllDesk() {
  const [rows, setRows] = useState<Ill[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get<Ill[]>('/library/ill').then((r) => setRows(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  const move = (r: Ill, status: IllStatus) => {
    const extra: { dueDate?: string; note?: string } = {};
    if (status === 'ON_LOAN') { const d = window.prompt('Due date from the lending library (YYYY-MM-DD)'); if (!d) return; extra.dueDate = d; }
    if (status === 'REJECTED') { const n = window.prompt('Why could it not be obtained? (the member sees this)'); if (!n) return; extra.note = n; }
    api.post(`/library/ill/${r.id}/move`, { status, ...extra }).then(() => { setMsg({ tone: 'success', text: `${r.title}: ${ILL_STATUS_LABEL[status]}.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  };
  const next: Record<string, Array<[IllStatus, string]>> = { REQUESTED: [['ORDERED', 'Ordered'], ['REJECTED', 'Cannot get']], ORDERED: [['ARRIVED', 'Arrived'], ['REJECTED', 'Cannot get']], ARRIVED: [['ON_LOAN', 'Issued'], ['RETURNED', 'Sent back']], ON_LOAN: [['RETURNED', 'Returned']] };
  if (!rows) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  return (
    <Card>
      <CardHeader title="Open inter-library loans" />
      {msg && <div className="px-4 pb-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {rows.length === 0 ? <CardBody><EmptyState title="None open" /></CardBody> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{r.title}</span>{r.authors ? `, ${r.authors}` : ''}<span className="block text-xs text-muted">For {r.requester?.firstName} {r.requester?.lastName} ({r.requester?.indexNumber ?? 'staff'}), {r.requester?.phone ?? ''}. Requested {formatDate(r.createdAt)}.{r.dueDate ? ` Due ${formatDate(r.dueDate)}.` : ''}</span></span>
              <span className="flex flex-wrap items-center gap-2"><Badge>{ILL_STATUS_LABEL[r.status]}</Badge>{(next[r.status] ?? []).map(([s, label]) => <Button key={s} size="sm" variant={s === 'REJECTED' ? 'ghost' : 'secondary'} onClick={() => move(r, s)}>{label}</Button>)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Lecturers (their courses) and the Librarian (any course): edit a course's reading list. */
export function ReadingListEditor({ showDemand = false }: { showDemand?: boolean }) {
  const [courses, setCourses] = useState<Array<{ id: string; code: string; title: string; items: number }> | null>(null);
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState<Array<{ titleId: string | null; label: string; citation?: string; url?: string; importance: 'ESSENTIAL' | 'RECOMMENDED'; note?: string }>>([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<Array<{ id: string; title: string; authors: string[] }>>([]);
  const [cite, setCite] = useState({ citation: '', url: '' });
  const [demand, setDemand] = useState<Array<{ course: string; title: string; students: number; copies: number; hasEbook: boolean; shortBy: number }> | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => {
    api.get('/library/reading-lists/editable').then((r) => { setCourses(r.data); setCourseId(r.data[0]?.id ?? ''); }).catch(() => setCourses([]));
    if (showDemand) api.get('/library/reading-lists/demand').then((r) => setDemand(r.data)).catch(() => undefined);
  }, [showDemand]);
  useEffect(() => {
    if (!courseId) return;
    api.get<ReadingList | null>(`/library/reading-lists/${courseId}`).then((r) => setItems((r.data?.items ?? []).map((i) => ({ titleId: i.title?.id ?? null, label: i.title ? i.title.title : i.citation ?? '', citation: i.citation ?? undefined, url: i.url ?? undefined, importance: i.importance, note: i.note ?? undefined }))));
  }, [courseId]);
  useEffect(() => {
    if (search.trim().length < 2) { setFound([]); return; }
    const t = window.setTimeout(() => libraryApi.search({ search: search.trim(), page: 1, pageSize: 8 }).then((r) => setFound(r.items)).catch(() => undefined), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  const save = () => api.put(`/library/reading-lists/${courseId}`, { items: items.map(({ label: _l, ...i }) => i) }).then(() => setMsg({ tone: 'success', text: 'Reading list saved. Students on the course see it on their Library page.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  if (!courses) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {showDemand && demand && (
        <Card>
          <CardHeader title="Essential books short of copies" description="For this semester's enrolment: at least one copy per 10 students, unless there is an e-book." />
          {demand.filter((d) => d.shortBy > 0).length === 0 ? <CardBody><p className="text-sm text-muted">Every essential title has enough copies.</p></CardBody> : (
            <ul className="divide-y divide-border">{demand.filter((d) => d.shortBy > 0).map((d, i) => <li key={i} className="flex justify-between gap-3 px-4 py-2 text-sm sm:px-5"><span>{d.title}<span className="block text-xs text-muted">{d.course}: {d.students} students, {d.copies} copies</span></span><Badge tone="warning">{d.shortBy} more needed</Badge></li>)}</ul>
          )}
        </Card>
      )}
      {courses.length === 0 ? <EmptyState title="No courses to edit" description="Lecturers edit reading lists for courses they teach this semester." /> : (
        <Card>
          <CardHeader title="Reading list" actions={<Select aria-label="Course" className="w-72" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</Select>} />
          <CardBody className="flex flex-col gap-3">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            {items.length === 0 ? <p className="text-sm text-muted">Nothing on this list yet.</p> : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {items.map((i, n) => (
                  <li key={n} className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>{i.label}{i.url ? <span className="text-muted"> ({i.url})</span> : null}</span>
                    <span className="flex gap-2">
                      <Select aria-label="Importance" className="w-40" value={i.importance} onChange={(e) => setItems(items.map((x, j) => (j === n ? { ...x, importance: e.target.value as 'ESSENTIAL' } : x)))}><option value="ESSENTIAL">Essential</option><option value="RECOMMENDED">Recommended</option></Select>
                      <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== n))}>Remove</Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Field label="Add a book from the catalogue" htmlFor="rl-s"><Input id="rl-s" value={search} placeholder="Title, author or ISBN" onChange={(e) => setSearch(e.target.value)} /></Field>
            {found.length > 0 && <ul className="flex flex-col gap-1 text-sm">{found.map((t) => <li key={t.id}><button className="text-primary hover:underline" onClick={() => { setItems([...items, { titleId: t.id, label: t.title, importance: 'ESSENTIAL' }]); setSearch(''); }}>{t.title}</button> <span className="text-muted">{t.authors.join(', ')}</span></li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
              <Field label="Or a reference (article, chapter, website)" htmlFor="rl-c"><Input id="rl-c" value={cite.citation} maxLength={400} onChange={(e) => setCite({ ...cite, citation: e.target.value })} /></Field>
              <Field label="Link (optional)" htmlFor="rl-u"><Input id="rl-u" value={cite.url} maxLength={500} onChange={(e) => setCite({ ...cite, url: e.target.value })} /></Field>
              <div className="flex items-end"><Button variant="secondary" disabled={cite.citation.trim().length < 3} onClick={() => { setItems([...items, { titleId: null, label: cite.citation.trim(), citation: cite.citation.trim(), url: cite.url.trim() || undefined, importance: 'RECOMMENDED' }]); setCite({ citation: '', url: '' }); }}>Add</Button></div>
            </div>
            <div><Button onClick={save}>Save reading list</Button></div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** On a title's page: an e-book link or the library's own PDF. */
export function TitleEbook({ titleId, ebookUrl, hasFile }: { titleId: string; ebookUrl: string | null; hasFile: boolean }) {
  const [url, setUrl] = useState(ebookUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const save = (body: { ebookUrl?: string | null; documentId?: string | null }) => api.put(`/library/titles/${titleId}/ebook`, body).then(() => setMsg({ tone: 'success', text: 'E-book saved. Members see "Read e-book" in the catalogue and on reading lists.' })).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) }));
  return (
    <Card>
      <CardHeader title="E-book" description="A link to a platform the university subscribes to, or a PDF the library has the right to share (stored privately; members only)." />
      <CardBody className="flex flex-col gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {(ebookUrl || hasFile) && <a className="text-sm text-primary hover:underline" href={readHref(titleId)} target="_blank" rel="noreferrer">Open the e-book</a>}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Platform link" htmlFor="eb-u"><Input id="eb-u" className="w-96 max-w-full" value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)} /></Field>
          <Button variant="secondary" disabled={!/^https:\/\//.test(url)} onClick={() => save({ ebookUrl: url })}>Save link</Button>
        </div>
        <label className="inline-flex h-9 w-fit cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
          {busy ? 'Uploading…' : 'Upload a PDF instead'}
          <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); try { const d = await uploadDocument('EBOOK', file, titleId); await save({ documentId: d.id }); } catch (err) { setMsg({ tone: 'danger', text: err instanceof Error && !('response' in err) ? err.message : errorMessage(err) }); } finally { setBusy(false); } }} />
        </label>
        {(ebookUrl || hasFile) && <div><Button variant="ghost" size="sm" onClick={() => save({ ebookUrl: null, documentId: null })}>Remove the e-book</Button></div>}
      </CardBody>
    </Card>
  );
}
