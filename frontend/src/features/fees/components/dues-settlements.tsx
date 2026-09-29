'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { feesApi, type DuesSettlement } from '../api';
import { PayNowButton } from './pay-now';

/** Online dues the university holds for each association, and payouts to them. */
export function DuesSettlements() {
  const [rows, setRows] = useState<DuesSettlement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<DuesSettlement | null>(null);
  const load = useCallback(() => { feesApi.duesSettlements().then(setRows).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <Card>
      <CardHeader title="Departmental dues" description="Online dues are collected by the university and paid out to each association. Cash is held by the association's officers and shown for reference." />
      {rows.length === 0 ? <CardBody><EmptyState title="No associations yet" /></CardBody> : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{a.code}</span> {a.name}
                <span className="block text-xs text-muted">Online {formatCedis(a.online)}, paid out {formatCedis(a.paidOut)}. Cash held by officers {formatCedis(a.cash)}. Payout: {a.payoutNumber ? `${a.payoutNetwork} ${a.payoutNumber}, ${a.payoutName ?? ''}` : 'not set by the Dean of Students office'}.</span></span>
              <span className="flex items-center gap-3"><span className="font-medium tabular-nums">{formatCedis(a.owed)} owed</span>{a.owed > 0 && <PayNowButton purpose="ASSOCIATION" subjectId={a.id} amount={a.owed} label={a.code} onDone={load} />}{a.owed > 0 && <Button size="sm" variant="secondary" onClick={() => setPaying(a)}>Record payout</Button>}</span>
            </li>
          ))}
        </ul>
      )}
      {paying && <PayoutDialog a={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
    </Card>
  );
}

function PayoutDialog({ a, onClose, onDone }: { a: DuesSettlement; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(a.owed / 100));
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await feesApi.duesPayout({ associationId: a.id, amount: Math.round(Number(amount) * 100), reference: reference.trim() || undefined }); onDone(); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`Record payout to ${a.code}`} description="Record a payment you have already sent. This does not send money.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Amount (GH₵)" htmlFor="dp-amt"><Input id="dp-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Transaction ID (optional)" htmlFor="dp-ref"><Input id="dp-ref" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!(Number(amount) > 0)} onClick={save}>Record payout</Button></div>
      </div>
    </Dialog>
  );
}
