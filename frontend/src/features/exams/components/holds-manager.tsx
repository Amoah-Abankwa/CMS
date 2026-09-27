'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { examsApi, HOLD_LABELS, type Hold, type HoldCategory } from '../api';

type Lookup = Awaited<ReturnType<typeof examsApi.holdStudent>>;

export function HoldsManager() {
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [lifting, setLifting] = useState<Hold | null>(null);

  const load = () =>
    examsApi.holds().then((d) => { setHolds(d.items); setLabel(d.semester.label); }).catch((err) => setError(errorMessage(err)));
  useEffect(() => {
    void load();
  }, []);

  if (!holds && !error) return <Spinner />;
  const active = holds?.filter((h) => !h.liftedAt) ?? [];
  const lifted = holds?.filter((h) => h.liftedAt) ?? [];

  const row = (h: Hold) => (
    <li key={h.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <span className="min-w-0 text-sm">
        <span className="font-medium">{h.student.firstName} {h.student.lastName}</span> <span className="font-mono text-xs text-muted">{h.student.indexNumber}</span>
        <span className="mt-0.5 flex flex-wrap gap-1.5">
          <Badge tone={h.liftedAt ? 'neutral' : 'danger'}>{HOLD_LABELS[h.category]}</Badge>
          <Badge>{h.offering ? h.offering.course.code : 'All papers'}</Badge>
        </span>
        <span className="mt-1 block text-xs text-muted">
          {h.reason} Placed {formatDateTime(h.createdAt)}{h.placedBy ? ` by ${h.placedBy}` : ''}.
          {h.liftedAt ? ` Lifted ${formatDateTime(h.liftedAt)}: ${h.liftReason}` : ''}
        </span>
      </span>
      {!h.liftedAt && <Button variant="secondary" size="sm" onClick={() => setLifting(h)}>Lift hold</Button>}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}. Students see only the kind of hold, never the reason written here.</p>
        <Button size="sm" onClick={() => setPlacing(true)}>Place a hold</Button>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {active.length === 0 ? (
        <EmptyState title="No active holds" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">{active.map(row)}</ul>
      )}
      {lifted.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">{lifted.length} lifted {lifted.length === 1 ? 'hold' : 'holds'}</summary>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">{lifted.map(row)}</ul>
        </details>
      )}
      <PlaceHoldDialog open={placing} onClose={() => setPlacing(false)} onPlaced={() => { setPlacing(false); setNotice('Hold placed. Recalculate and publish eligibility to tell the student.'); void load(); }} />
      <LiftHoldDialog hold={lifting} onClose={() => setLifting(null)} onLifted={() => { setLifting(null); setNotice('Hold lifted. Recalculate and publish eligibility to tell the student.'); void load(); }} />
    </div>
  );
}

function PlaceHoldDialog({ open, onClose, onPlaced }: { open: boolean; onClose: () => void; onPlaced: () => void }) {
  const [indexNumber, setIndexNumber] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [offeringId, setOfferingId] = useState('');
  const [category, setCategory] = useState<HoldCategory>('DISCIPLINARY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIndexNumber(''); setLookup(null); setOfferingId(''); setCategory('DISCIPLINARY'); setReason(''); setError(null);
  }, [open]);

  const find = async () => {
    setError(null);
    setLookup(null);
    try {
      setLookup(await examsApi.holdStudent(indexNumber.trim()));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const place = async () => {
    setBusy(true);
    setError(null);
    try {
      await examsApi.placeHold({ indexNumber: lookup!.student.indexNumber, offeringId: offeringId || undefined, category, reason: reason.trim() });
      onPlaced();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Place an exam hold">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Student index number" htmlFor="hold-index">
              <Input id="hold-index" autoCapitalize="characters" value={indexNumber} onChange={(e) => setIndexNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void find()} />
            </Field>
          </div>
          <Button variant="secondary" onClick={find} disabled={indexNumber.trim().length < 8}>Find</Button>
        </div>
        {lookup && (
          <>
            <p className="text-sm">{lookup.student.firstName} {lookup.student.lastName}</p>
            <Field label="Applies to" htmlFor="hold-offering">
              <Select id="hold-offering" value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
                <option value="">All their papers this semester</option>
                {lookup.offerings.map((o) => <option key={o.id} value={o.id}>{o.course.code} {o.course.title}</option>)}
              </Select>
            </Field>
            <Field label="Kind of hold" htmlFor="hold-category" hint="This is what the student sees.">
              <Select id="hold-category" value={category} onChange={(e) => setCategory(e.target.value as HoldCategory)}>
                {(Object.keys(HOLD_LABELS) as HoldCategory[]).map((c) => <option key={c} value={c}>{HOLD_LABELS[c]}</option>)}
              </Select>
            </Field>
            <Field label="Internal reason" htmlFor="hold-reason" hint="Visible to staff and the activity log only.">
              <Textarea id="hold-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!lookup || reason.trim().length < 5} onClick={place}>Place hold</Button>
        </div>
      </div>
    </Dialog>
  );
}

function LiftHoldDialog({ hold, onClose, onLifted }: { hold: Hold | null; onClose: () => void; onLifted: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(''); setError(null); }, [hold]);
  if (!hold) return null;

  const lift = async () => {
    setBusy(true);
    try {
      await examsApi.liftHold(hold.id, reason.trim());
      onLifted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Lift hold on ${hold.student.firstName} ${hold.student.lastName}`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Why is it being lifted?" htmlFor="lift-reason">
          <Textarea id="lift-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={reason.trim().length < 5} onClick={lift}>Lift hold</Button>
        </div>
      </div>
    </Dialog>
  );
}
