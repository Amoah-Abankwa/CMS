'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, PRIORITY_LABELS } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fromLocalInput, toLocalInput } from '@/lib/format';
import { cn } from '@/lib/cn';
import { accommodationApi, ALLOCATION_LABEL, ALLOCATION_TONE, type AllocationRow, type ApplicationRow, type Round, type RunSummary, type UniversityHostel } from '../api';
import { RoomPicker } from './room-picker';

const PAGE_SIZE = 25;

export function AllocationManager() {
  const [round, setRound] = useState<Round | null>(null);
  const [hostels, setHostels] = useState<UniversityHostel[]>([]);
  const [tab, setTab] = useState<'applications' | 'allocations'>('applications');
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [manual, setManual] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const loadTop = useCallback(() => {
    accommodationApi.round().then(setRound).catch((err) => setError(errorMessage(err)));
    accommodationApi.university().then((d) => setHostels(d.items)).catch(() => undefined);
  }, []);
  useEffect(loadTop, [loadTop, refresh]);

  const act = async (kind: string, fn: () => Promise<string>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirmPublish(false);
    }
  };

  if (!round) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <RoundCard round={round} onSaved={() => { setNotice('Application window saved.'); setRefresh((n) => n + 1); }} />
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          Allocation places students in priority order: confirmed special needs, first years, final years, then everyone else, each by application date. Partly filled rooms are filled first.
          {round.round?.lastRunAt ? ` Last run ${formatDateTime(round.round.lastRunAt)}.` : ''}{round.round?.lastPublishedAt ? ` Last published ${formatDateTime(round.round.lastPublishedAt)}.` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === 'run'} onClick={() => act('run', async () => {
            const s = await accommodationApi.run();
            setSummary(s);
            setTab('allocations');
            return `Allocation run: ${s.placed} of ${s.applicants} placed. Nothing is visible to students until you publish.`;
          })}>Run allocation</Button>
          <Button onClick={() => setConfirmPublish(true)}>Publish offers</Button>
          <Button variant="ghost" onClick={() => setManual(true)}>Place a student by hand</Button>
        </div>
        {summary && (
          <p className="text-sm text-muted">
            {summary.placed} placed ({summary.firstChoice} first choice{summary.anyHostel ? `, ${summary.anyHostel} in another hostel` : ''}). {summary.unplaced.noBed} without a bed.
            {summary.unplaced.noGender ? ` ${summary.unplaced.noGender} could not be placed because their record has no gender.` : ''}
          </p>
        )}
      </section>

      <div role="tablist" aria-label="View" className="flex gap-1 border-b border-border">
        {(['applications', 'allocations'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm capitalize', tab === t ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-text')}>
            {t === 'applications' ? 'Applications' : 'Places'}
          </button>
        ))}
      </div>
      {tab === 'applications' ? <Applications refresh={refresh} /> : <Allocations hostels={hostels} refresh={refresh} onChanged={(m) => { setNotice(m); setRefresh((n) => n + 1); }} />}

      <Dialog open={confirmPublish} onClose={() => setConfirmPublish(false)} title="Publish hostel offers?">
        <div className="flex flex-col gap-4">
          <p className="text-sm">Every provisional place becomes an offer. Students get an email and SMS and have {round.round?.acceptanceDays ?? 5} days to accept. Students still without a bed are told they are on the waiting list.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmPublish(false)}>Cancel</Button>
            <Button loading={busy === 'publish'} onClick={() => act('publish', async () => {
              const r = await accommodationApi.publish();
              return `${r.offered} offers sent, to be accepted by ${formatDateTime(r.acceptBy)}. ${r.waiting} on the waiting list.`;
            })}>Publish offers</Button>
          </div>
        </div>
      </Dialog>
      <ManualDialog open={manual} hostels={hostels} onClose={() => setManual(false)} onDone={() => { setManual(false); setNotice('Student placed and sent an offer.'); setRefresh((n) => n + 1); }} />
    </div>
  );
}

function RoundCard({ round, onSaved }: { round: Round; onSaved: () => void }) {
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [days, setDays] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOpens(toLocalInput(round.round?.opensAt));
    setCloses(toLocalInput(round.round?.closesAt));
    setDays(String(round.round?.acceptanceDays ?? 5));
  }, [round]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accommodationApi.saveRound({ opensAt: fromLocalInput(opens)!, closesAt: fromLocalInput(closes)!, acceptanceDays: Number(days) });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title={`Applications for ${round.semester.label}`} actions={<Badge tone={round.open ? 'success' : 'neutral'}>{round.open ? 'Open' : 'Closed'}</Badge>} />
      <CardBody>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          {error && <div className="sm:col-span-4"><Alert tone="danger">{error}</Alert></div>}
          <Field label="Open from" htmlFor="rd-open"><Input id="rd-open" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></Field>
          <Field label="Close at" htmlFor="rd-close"><Input id="rd-close" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
          <Field label="Days to accept an offer" htmlFor="rd-days"><Input id="rd-days" type="number" inputMode="numeric" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
          <Button type="submit" loading={busy} disabled={!opens || !closes}>Save</Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Applications({ refresh }: { refresh: number }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ counts: Record<string, number>; total: number; items: ApplicationRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => accommodationApi.applications({ status: status || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))), [status, search, page]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load, refresh]);

  const confirmNeed = async (id: string, approved: boolean) => {
    try {
      await accommodationApi.specialNeeds(id, approved);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All applications</option>
          <option value="SUBMITTED">Waiting ({data?.counts.SUBMITTED ?? 0})</option>
          <option value="ALLOCATED">Offered a place ({data?.counts.ALLOCATED ?? 0})</option>
          <option value="UNPLACED">Waiting list ({data?.counts.UNPLACED ?? 0})</option>
          <option value="WITHDRAWN">Withdrawn or lapsed ({data?.counts.WITHDRAWN ?? 0})</option>
          <option value="SPECIAL_NEEDS">With a special need</option>
        </Select>
        <Input type="search" aria-label="Search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No applications match" /> : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{a.student.firstName} {a.student.lastName}</span> <span className="font-mono text-xs text-muted">{a.student.indexNumber}</span>
                  <span className="block text-xs text-muted">
                    {a.student.studentProfile?.gender ?? 'Gender not recorded'}, level {a.student.studentProfile?.currentLevel}. Applied {formatDateTime(a.submittedAt)}.
                  </span>
                  <span className="block text-xs">{a.preferences.map((p, i) => `${i + 1}. ${p.hostelName}${p.roomType ? ` (${p.roomType})` : ''}`).join('  ')}{a.acceptAny ? '. Any hostel if full.' : ''}</span>
                  {a.specialNeeds && <span className="mt-1 block rounded bg-surface-muted px-2 py-1 text-xs">Need: {a.specialNeeds}</span>}
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone={a.group === 'SPECIAL_NEEDS' ? 'primary' : 'neutral'}>{PRIORITY_LABELS[a.group]}</Badge>
                  <Badge>{a.status.toLowerCase()}</Badge>
                  {a.specialNeeds && a.status === 'SUBMITTED' && (
                    <Button variant="secondary" size="sm" onClick={() => confirmNeed(a.id, !a.specialNeedsApproved)}>{a.specialNeedsApproved ? 'Remove priority' : 'Confirm need'}</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3"><Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}

function Allocations({ hostels, refresh, onChanged }: { hostels: UniversityHostel[]; refresh: number; onChanged: (m: string) => void }) {
  const [items, setItems] = useState<AllocationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<AllocationRow | null>(null);
  const [cancelling, setCancelling] = useState<AllocationRow | null>(null);
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    accommodationApi.allocations().then((d) => setItems(d.items)).catch((err) => setError(errorMessage(err)));
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      setMoving(null);
      setCancelling(null);
      setRoomId('');
      setReason('');
      onChanged(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!items) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!items.length) return <EmptyState title="No places yet" description="Run allocation to place students who applied." />;

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="rounded-lg border border-border bg-surface">
        <ul className="divide-y divide-border">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{a.room.hostel.name} {a.room.number}</span>: {a.student.firstName} {a.student.lastName} <span className="font-mono text-xs text-muted">{a.student.indexNumber}</span>
                <span className="block text-xs text-muted">
                  {a.room.roomType}, {formatCedis(a.room.pricePerSemester)}. {a.source === 'MANUAL' ? 'Placed by hand.' : a.preferenceRank ? `Choice ${a.preferenceRank}.` : 'Any hostel.'}
                  {a.acceptBy && a.status === 'OFFERED' ? ` Reply by ${formatDateTime(a.acceptBy)}.` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={ALLOCATION_TONE[a.status]}>{ALLOCATION_LABEL[a.status]}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setMoving(a)}>Move</Button>
                <Button variant="ghost" size="sm" onClick={() => setCancelling(a)}>Cancel</Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Dialog open={!!moving} onClose={() => setMoving(null)} title={moving ? `Move ${moving.student.firstName} ${moving.student.lastName}` : ''} description={moving ? `Now in ${moving.room.hostel.name} ${moving.room.number}.` : ''}>
        <div className="flex flex-col gap-4">
          <RoomPicker hostels={hostels.filter((h) => !moving || h.gender === (moving.student.studentProfile?.gender === 'Female' ? 'FEMALE' : 'MALE'))} value={roomId} onChange={setRoomId} excludeRoomId={moving?.room.id} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoving(null)}>Cancel</Button>
            <Button loading={busy} disabled={!roomId} onClick={() => moving && run(() => accommodationApi.move(moving.id, roomId), 'Student moved.')}>Move student</Button>
          </div>
        </div>
      </Dialog>
      <Dialog open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this place?" description={cancelling ? `${cancelling.student.firstName} ${cancelling.student.lastName}, ${cancelling.room.hostel.name} ${cancelling.room.number}. The student is told if they had an offer.` : ''}>
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="cancel-alloc"><Input id="cancel-alloc" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)}>Keep it</Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => cancelling && run(() => accommodationApi.cancelAllocation(cancelling.id, reason.trim()), 'Place cancelled.')}>Cancel place</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ManualDialog({ open, hostels, onClose, onDone }: { open: boolean; hostels: UniversityHostel[]; onClose: () => void; onDone: () => void }) {
  const [index, setIndex] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setIndex(''); setRoomId(''); setError(null); } }, [open]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await accommodationApi.manual(index.trim().toUpperCase(), roomId);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Place a student by hand" description="For late applications or urgent cases. The student is sent an offer straight away.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Index number" htmlFor="man-index"><Input id="man-index" autoCapitalize="characters" value={index} onChange={(e) => setIndex(e.target.value)} /></Field>
        <RoomPicker hostels={hostels} value={roomId} onChange={setRoomId} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={index.trim().length < 8 || !roomId} onClick={save}>Place and send offer</Button>
        </div>
      </div>
    </Dialog>
  );
}
