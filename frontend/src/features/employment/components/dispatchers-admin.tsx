'use client';

import { useCallback, useEffect, useState } from 'react';
import { DISPATCHER_STATUS_LABEL, formatCedis, type DispatcherStatus } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { cgpaText, DISPATCHER_TONE, TRANSPORT_LABEL, workApi, type AdminDispatcher } from '../api';

type Review = 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ENDED';

export function DispatchersAdmin() {
  const [status, setStatus] = useState<DispatcherStatus | ''>('');
  const [rows, setRows] = useState<AdminDispatcher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ d: AdminDispatcher; to: Review } | null>(null);
  const load = useCallback(() => { setRows(null); workApi.dispatchers(status || undefined).then(setRows).catch((err) => setError(errorMessage(err))); }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title="Dispatchers" description="Approving adds deliveries to the student's account. Dispatchers who stop meeting the rules are suspended automatically each morning."
          actions={
            <Select aria-label="Show" className="w-44" value={status} onChange={(e) => setStatus(e.target.value as DispatcherStatus | '')}>
              <option value="">Everyone</option>
              {(Object.keys(DISPATCHER_STATUS_LABEL) as DispatcherStatus[]).map((s) => <option key={s} value={s}>{DISPATCHER_STATUS_LABEL[s]}</option>)}
            </Select>
          } />
        {!rows ? <CardBody><Spinner /></CardBody> : rows.length === 0 ? <CardBody><EmptyState title="Nobody here" /></CardBody> : (
          <ul className="divide-y divide-border">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span className="text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {d.student.firstName} {d.student.lastName} <span className="font-normal text-muted">{d.student.indexNumber}</span>
                      <Badge tone={DISPATCHER_TONE[d.status]}>{DISPATCHER_STATUS_LABEL[d.status]}</Badge>
                      {d.status === 'ACTIVE' && d.online && <Badge tone="success">online</Badge>}
                    </span>
                    <span className="block text-xs text-muted">
                      CGPA {cgpaText(d.cgpa)}. {TRANSPORT_LABEL[d.transport]}. {d.student.phone ?? ''}. Payout {d.payoutNetwork} {d.payoutNumber}. Applied {formatDate(d.createdAt)}.
                    </span>
                    {d.status !== 'PENDING' && <span className="block text-xs text-muted">Last 30 days: {d.deliveriesLast30Days} deliveries, {formatCedis(d.earnedLast30Days)} earned.</span>}
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-2">
                    {d.status === 'PENDING' && (
                      <>
                        <Button size="sm" disabled={!d.eligibility.eligible} onClick={() => setReviewing({ d, to: 'ACTIVE' })}>Approve</Button>
                        <Button variant="ghost" size="sm" onClick={() => setReviewing({ d, to: 'REJECTED' })}>Turn down</Button>
                      </>
                    )}
                    {d.status === 'ACTIVE' && <Button variant="secondary" size="sm" onClick={() => setReviewing({ d, to: 'SUSPENDED' })}>Suspend</Button>}
                    {d.status === 'SUSPENDED' && <Button size="sm" disabled={!d.eligibility.eligible} onClick={() => setReviewing({ d, to: 'ACTIVE' })}>Lift suspension</Button>}
                    {(d.status === 'ACTIVE' || d.status === 'SUSPENDED') && <Button variant="ghost" size="sm" onClick={() => setReviewing({ d, to: 'ENDED' })}>End</Button>}
                  </span>
                </div>
                {!d.eligibility.eligible && ['PENDING', 'ACTIVE', 'SUSPENDED'].includes(d.status) && <Alert tone="warning" title="Does not meet the rules">{d.eligibility.reasons.join(' ')}</Alert>}
                {d.status === 'PENDING' && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm">{d.statement}</p>}
                {d.statusNote && d.status !== 'PENDING' && <p className="text-xs text-muted">Note: {d.statusNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ReviewDialog target={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load(); }} />
    </div>
  );
}

function ReviewDialog({ target, onClose, onDone }: { target: { d: AdminDispatcher; to: Review } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); setError(null); }, [target]);
  if (!target) return null;
  const { d, to } = target;
  const verb = { ACTIVE: d.status === 'SUSPENDED' ? 'Lift suspension' : 'Approve', REJECTED: 'Turn down', SUSPENDED: 'Suspend', ENDED: 'End' }[to];
  const submit = async () => {
    setBusy(true);
    try {
      await workApi.reviewDispatcher(d.id, to, note.trim() || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`${verb}: ${d.student.firstName} ${d.student.lastName}?`}
      description={to === 'ACTIVE' ? 'They can go online and take deliveries straight away.' : to === 'SUSPENDED' ? 'They stop receiving deliveries until you lift the suspension.' : 'The student is told, with your reason.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={to === 'ACTIVE' ? 'Note (optional)' : 'Reason (the student sees it)'} htmlFor="dr-note"><Textarea id="dr-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={to === 'ACTIVE' ? 'primary' : 'danger'} loading={busy} disabled={to !== 'ACTIVE' && note.trim().length < 3} onClick={submit}>{verb}</Button>
        </div>
      </div>
    </Dialog>
  );
}
