'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate, formatDateTime } from '@/lib/format';
import { attendanceApi, EXCUSE_LABEL, type Excuse, type ExcuseCategory } from '../api';

const PAGE_SIZE = 25;

/** Health Services and the Dean of Students record excused absences. Lecturers only ever see "Excused". */
export function ExcusesManager() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Excuse[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [revoking, setRevoking] = useState<Excuse | null>(null);

  const load = useCallback(() => attendanceApi.excuses({ search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))), [search, page]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  if (!data && !error) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-72">
          <label htmlFor="exc-search" className="sr-only">Search</label>
          <Input id="exc-search" type="search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button size="sm" onClick={() => setRecording(true)}>Record an excused absence</Button>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {data?.items.length === 0 ? (
        <EmptyState title="No excused absences recorded" />
      ) : data && (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{x.student.firstName} {x.student.lastName}</span> <span className="font-mono text-xs text-muted">{x.student.indexNumber}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    <Badge tone={x.revokedAt ? 'neutral' : 'primary'}>{EXCUSE_LABEL[x.category]}</Badge>
                    <Badge>{formatDate(x.fromDate)}{x.toDate !== x.fromDate ? ` to ${formatDate(x.toDate)}` : ''}</Badge>
                    {x.revokedAt && <Badge tone="danger">Withdrawn</Badge>}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {x.note} Recorded {formatDateTime(x.createdAt)}{x.recordedBy ? ` by ${x.recordedBy}` : ''}.{x.revokedAt ? ` Withdrawn: ${x.revokeReason}` : ''}
                  </span>
                </span>
                {!x.revokedAt && <Button variant="secondary" size="sm" onClick={() => setRevoking(x)}>Withdraw</Button>}
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
      <RecordDialog open={recording} onClose={() => setRecording(false)} onDone={(n) => { setRecording(false); setNotice(`Excuse recorded. ${n ? `Attendance updated in ${n} ${n === 1 ? 'course' : 'courses'}.` : 'It will apply to classes in those dates as registers are taken.'}`); void load(); }} />
      <RevokeDialog excuse={revoking} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); setNotice('Excuse withdrawn. Those absences count again.'); void load(); }} />
    </div>
  );
}

function RecordDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (courses: number) => void }) {
  const [form, setForm] = useState({ indexNumber: '', fromDate: '', toDate: '', category: 'MEDICAL' as ExcuseCategory, note: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm({ indexNumber: '', fromDate: '', toDate: '', category: 'MEDICAL', note: '' }); setError(null); } }, [open]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await attendanceApi.recordExcuse({ ...form, toDate: form.toDate || form.fromDate, indexNumber: form.indexNumber.trim() });
      onDone(r.coursesAffected);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Record an excused absence" description="Absences in these dates will not count against the student.">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Student index number" htmlFor="exc-index">
          <Input id="exc-index" autoCapitalize="characters" value={form.indexNumber} onChange={(e) => set('indexNumber', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="exc-from"><Input id="exc-from" type="date" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></Field>
          <Field label="To" htmlFor="exc-to" hint="Leave empty for a single day."><Input id="exc-to" type="date" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></Field>
        </div>
        <Field label="Kind" htmlFor="exc-cat">
          <Select id="exc-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {(Object.keys(EXCUSE_LABEL) as ExcuseCategory[]).map((c) => <option key={c} value={c}>{EXCUSE_LABEL[c]}</option>)}
          </Select>
        </Field>
        <Field label="Internal note" htmlFor="exc-note" hint="For example the clinic record number. Lecturers and the student's classmates never see it.">
          <Textarea id="exc-note" value={form.note} maxLength={500} onChange={(e) => set('note', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!form.indexNumber.trim() || !form.fromDate || form.note.trim().length < 5}>Record excuse</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RevokeDialog({ excuse, onClose, onDone }: { excuse: Excuse | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(''); setError(null); }, [excuse]);
  if (!excuse) return null;
  const revoke = async () => {
    setBusy(true);
    try {
      await attendanceApi.revokeExcuse(excuse.id, reason.trim());
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="Withdraw this excuse?" description="Absences in these dates will count again.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" htmlFor="rev-reason"><Textarea id="rev-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={revoke}>Withdraw excuse</Button>
        </div>
      </div>
    </Dialog>
  );
}
