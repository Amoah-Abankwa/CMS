'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import type { Semester } from '@/features/academics/api';
import { clock, devotionApi, serviceDay, type DevotionServiceRow } from '../api';

export function ServicesManager() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [data, setData] = useState<{ semester: Semester; expected: number; items: DevotionServiceRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<DevotionServiceRow | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = () => devotionApi.services(semesterId || undefined).then(setData).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    setData(null);
    void load();
  }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await devotionApi.generate(data?.semester.id);
      setNotice(r.created ? `${r.created} services added for the semester.` : 'Every devotion day this semester already has a service.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const today = new Date().toISOString().slice(0, 10);
  const live = data.items.find((s) => s.live);
  const upcoming = data.items.filter((s) => s.date.slice(0, 10) >= today && !s.closedAt);
  const past = data.items.filter((s) => s.date.slice(0, 10) < today || s.closedAt).reverse();

  const row = (s: DevotionServiceRow) => (
    <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-sm">
        <span className="font-medium">{serviceDay(s.date)}</span>
        {s.theme && <span className="text-muted">, {s.theme}</span>}
        <span className="block text-xs text-muted">
          {s.cancelledAt ? `Cancelled: ${s.cancelReason}` : s.closedAt || s.live ? `${s.counts.early} early, ${s.counts.late} late, ${s.counts.absent} absent${s.counts.excused ? `, ${s.counts.excused} excused` : ''}` : `${clock(s.startsAt)} to ${clock(s.endsAt)}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-2">
        {s.live && <Badge tone="success">Happening now</Badge>}
        {s.cancelledAt && <Badge>Cancelled</Badge>}
        {!s.cancelledAt && <Link href={`/chaplaincy/services/${s.id}`} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-muted">{s.closedAt ? 'Records' : 'Door entry'}</Link>}
        {!s.cancelledAt && !s.closedAt && (
          <Link href={`/chaplaincy/screen/${s.id}`} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface-muted">Screen</Link>
        )}
        {!s.cancelledAt && !s.closedAt && !s.live && <Button variant="ghost" size="sm" onClick={() => setCancelling(s)}>Cancel</Button>}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      {semesters && <div className="max-w-sm"><SemesterSelect semesters={semesters} value={semesterId} onChangeAction={setSemesterId} /></div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{data.semester.label}. {data.expected} students expected (those with approved courses). {data.items.filter((s) => !s.cancelledAt).length} services.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>Add a special service</Button>
          <Button size="sm" loading={busy} onClick={generate}>Schedule the semester</Button>
        </div>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {live && (
        <section className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Devotion is happening now. {live.counts.early + live.counts.late} of {data.expected} recorded.</p>
          <div className="flex gap-2">
            <Link href={`/chaplaincy/screen/${live.id}`} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">Open projector screen</Link>
            <Link href={`/chaplaincy/services/${live.id}`} className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted">Door entry</Link>
          </div>
        </section>
      )}

      {data.items.length === 0 ? (
        <EmptyState title="No services scheduled" description="Schedule the semester to create a service for every devotion day." />
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Coming up</h2>
            {upcoming.length ? <ul className="divide-y divide-border rounded-lg border border-border bg-surface">{upcoming.slice(0, 8).map(row)}</ul> : <p className="text-sm text-muted">No more services this semester.</p>}
          </section>
          {past.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Past services ({past.length})</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>{showPast ? 'Hide' : 'Show'}</Button>
              </div>
              {showPast && <ul className="divide-y divide-border rounded-lg border border-border bg-surface">{past.map(row)}</ul>}
            </section>
          )}
        </>
      )}

      <AddDialog open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); setNotice('Service added.'); void load(); }} />
      <CancelDialog service={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); setNotice('Service cancelled. It does not count towards anyone.'); void load(); }} />
    </div>
  );
}

function AddDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState('');
  const [theme, setTheme] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDate(''); setTheme(''); setError(null); } }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      await devotionApi.addService(date, theme.trim() || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a special service" description="For example a week of prayer. It uses the usual times and counts towards scores.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Date" htmlFor="add-date"><Input id="add-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Theme (optional)" htmlFor="add-theme"><Input id="add-theme" value={theme} maxLength={120} onChange={(e) => setTheme(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!date} onClick={save}>Add service</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CancelDialog({ service, onClose, onDone }: { service: DevotionServiceRow | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(''); setError(null); }, [service]);
  if (!service) return null;
  const cancel = async () => {
    setBusy(true);
    try {
      await devotionApi.cancelService(service.id, reason.trim());
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Cancel ${serviceDay(service.date)}?`} description="A cancelled service is left out of every student's score.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" htmlFor="cancel-reason"><Input id="cancel-reason" placeholder="Public holiday" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Keep it</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={cancel}>Cancel service</Button>
        </div>
      </div>
    </Dialog>
  );
}
