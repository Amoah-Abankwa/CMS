'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { feesApi, type ExchangeRate } from '../api';

/** Cedis per US dollar, set by the Accounts office. The latest rate that has taken effect is used. */
export function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[] | null>(null);
  const [f, setF] = useState({ rate: '', from: new Date().toISOString().slice(0, 10), note: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { feesApi.rates().then(setRates).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ tone: 'success', text: ok }); load(); } catch (err) { setMsg({ tone: 'danger', text: errorMessage(err) }); } };
  if (!rates) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  const now = new Date();
  const current = rates.find((r) => new Date(r.effectiveFrom) <= now);
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <CardHeader title={current ? `Today: ${current.cedisPerDollar} cedis per US dollar` : 'No rate in force yet'} description="Used to show dollar bills in cedis and to convert payments made in the other currency. A payment uses the rate in force on the day it was paid." />
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); void run(() => feesApi.addRate({ cedisPerDollar: Number(f.rate), effectiveFrom: `${f.from}T00:00:00.000Z`, note: f.note.trim() || undefined }), 'Rate added.'); }}>
            <Field label="Cedis per US dollar" htmlFor="xr-r"><Input id="xr-r" type="number" step="0.0001" min={0.01} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
            <Field label="From" htmlFor="xr-f"><Input id="xr-f" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="Note (optional)" htmlFor="xr-n"><Input id="xr-n" value={f.note} maxLength={200} placeholder="Bank of Ghana rate" onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" disabled={!(Number(f.rate) > 0)}>Add rate</Button></div>
          </form>
          {Number(f.rate) > 0 && <p className="mt-2 text-xs text-muted">Check: {formatMoney(100000, 'USD')} = {formatMoney(Math.round(100000 * Number(f.rate)), 'GHS')}.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="All rates" description="To correct a rate, add a new one. A rate can only be removed if no payment used it." />
        {rates.length === 0 ? <CardBody><EmptyState title="No rates yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {rates.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span><span className="font-medium tabular-nums">{r.cedisPerDollar}</span> from {formatDate(r.effectiveFrom)} {r === current && <Badge tone="success">in force</Badge>}{new Date(r.effectiveFrom) > now && <Badge>future</Badge>}<span className="block text-xs text-muted">{r.note ?? ''}</span></span>
                <Button variant="ghost" size="sm" onClick={() => run(() => feesApi.deleteRate(r.id), 'Rate removed.')}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
