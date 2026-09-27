'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { clock, DEVOTION_LABEL, DEVOTION_TONE, devotionApi, serviceDay, type ServiceRecords } from '../api';

const PAGE_SIZE = 30;
type Entry = { key: number; text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' };

/**
 * Door entry for ushers: type or scan an index number and press Enter. The field clears and keeps focus,
 * so a queue can be processed quickly. Below, everyone expected with their status, and corrections.
 */
export function ServiceDetail({ serviceId }: { serviceId: string }) {
  const [data, setData] = useState<ServiceRecords | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState('');
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<ServiceRecords['items'][number] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () => devotionApi.records(serviceId, { status: status || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))),
    [serviceId, status, search, page],
  );
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = index.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setIndex('');
    try {
      const r = await devotionApi.door(serviceId, value);
      const name = `${r.student.firstName} ${r.student.lastName} (${r.student.indexNumber})`;
      setLog((l) => [{ key: Date.now(), text: r.alreadyRecorded ? `${name} was already recorded: ${DEVOTION_LABEL[r.status].toLowerCase()}` : `${name}: ${DEVOTION_LABEL[r.status].toLowerCase()} at ${clock(r.arrivedAt)}`, tone: r.alreadyRecorded ? 'neutral' : DEVOTION_TONE[r.status] }, ...l].slice(0, 8));
    } catch (err) {
      setLog((l) => [{ key: Date.now(), text: `${value}: ${errorMessage(err)}`, tone: 'danger' as const }, ...l].slice(0, 8));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const close = async () => {
    try {
      await devotionApi.close(serviceId);
      setNotice('Service closed. Everyone not recorded is now absent, or excused if they have an excuse.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const s = data.service;
  const now = new Date();
  const open = !s.closedAt && !s.cancelledAt && new Date(s.opensAt) <= now && now < new Date(s.endsAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={serviceDay(s.date)}
        description={`${s.theme ? `${s.theme}. ` : ''}Early until ${clock(s.lateFrom)}, late until ${clock(s.endsAt)}.${s.closedAt ? ' Closed.' : ''}`}
        actions={!s.closedAt && !s.cancelledAt && now >= new Date(s.lateFrom) ? <Button variant="secondary" size="sm" onClick={close}>Close service</Button> : undefined}
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {open ? (
        <Card>
          <CardHeader title="Door entry" description="Type or scan the index number, then press Enter." />
          <CardBody>
            <form onSubmit={enter} className="flex gap-2">
              <label htmlFor="door-index" className="sr-only">Index number</label>
              <Input id="door-index" ref={input} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono text-lg uppercase" placeholder="ANU26400001" value={index} onChange={(e) => setIndex(e.target.value)} />
              <Button type="submit" loading={busy}>Record</Button>
            </form>
            {log.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1" aria-live="polite">
                {log.map((l, i) => (
                  <li key={l.key} className={cn('rounded px-2 py-1 text-sm', i === 0 && 'font-medium', l.tone === 'success' && 'bg-success-soft', l.tone === 'warning' && 'bg-warning-soft', l.tone === 'danger' && 'bg-danger-soft')}>{l.text}</li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : (
        !s.closedAt && <Alert tone="info">Door entry is available from {clock(s.opensAt)} to {clock(s.endsAt)} on the day.</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rec-status" className="sr-only">Status</label>
          <Select id="rec-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            <option value="EARLY">Early</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="EXCUSED">Excused</option>
            <option value="NONE">Not recorded yet</option>
          </Select>
        </div>
        <div>
          <label htmlFor="rec-search" className="sr-only">Search</label>
          <Input id="rec-search" type="search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <ul className="divide-y divide-border">
          {data.items.map((st) => (
            <li key={st.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-mono text-xs text-muted">{st.indexNumber}</span> {st.firstName} {st.lastName}
                {st.record?.arrivedAt && <span className="block text-xs text-muted">Arrived {clock(st.record.arrivedAt)}{st.record.source === 'DOOR' ? ' at the door' : st.record.source === 'SELF_CHECK_IN' ? ' by code' : ''}</span>}
                {st.record?.source === 'CORRECTION' && st.record.note && <span className="block text-xs text-muted">Corrected: {st.record.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {st.record ? <Badge tone={DEVOTION_TONE[st.record.status]}>{DEVOTION_LABEL[st.record.status]}</Badge> : <Badge>Not recorded</Badge>}
                {st.record?.status !== 'EXCUSED' && now >= new Date(s.opensAt) && !s.cancelledAt && <Button variant="ghost" size="sm" onClick={() => setCorrecting(st)}>Correct</Button>}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
        </div>
      </div>
      <CorrectionDialog serviceId={serviceId} student={correcting} onClose={() => setCorrecting(null)} onDone={() => { setCorrecting(null); setNotice('Record corrected. The change is in the activity log.'); void load(); }} />
    </div>
  );
}

function CorrectionDialog({ serviceId, student, onClose, onDone }: { serviceId: string; student: ServiceRecords['items'][number] | null; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<'EARLY' | 'LATE' | 'ABSENT'>('EARLY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setStatus('EARLY'); setReason(''); setError(null); }, [student]);
  if (!student) return null;
  const save = async () => {
    setBusy(true);
    try {
      await devotionApi.correct(serviceId, student.id, status, reason.trim());
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Correct ${student.firstName} ${student.lastName}`} description={`Currently ${student.record ? DEVOTION_LABEL[student.record.status].toLowerCase() : 'not recorded'}.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Correct status" htmlFor="corr-status">
          <Select id="corr-status" value={status} onChange={(e) => setStatus(e.target.value as 'EARLY')}>
            <option value="EARLY">Early</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
          </Select>
        </Field>
        <Field label="Reason" htmlFor="corr-reason" hint="For example: usher's list shows arrival at 07:42.">
          <Textarea id="corr-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={reason.trim().length < 5} onClick={save}>Save correction</Button>
        </div>
      </div>
    </Dialog>
  );
}
