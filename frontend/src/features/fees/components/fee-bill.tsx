'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FEE_METHOD_LABEL, formatMoney } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { feesApi, semesterText, type Bill } from '../api';
import { PdfLink } from './pdf-link';

type Mode = 'payment' | 'adjust' | { reverse: string };

export function FeeBill({ id }: { id: string }) {
  const [b, setB] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => { feesApi.bill(id).then(setB).catch((err) => setError(errorMessage(err))); }, [id]);
  if (!b) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const s = b.student;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title={`${s.firstName} ${s.lastName}`} description={`${s.indexNumber}. ${s.studentProfile ? `${s.studentProfile.programme.name}, level ${s.studentProfile.currentLevel}. ` : ''}${semesterText(b.semester)}.`}
          actions={b.clearance?.cleared ? <Badge tone="success">Cleared{b.clearance.source === 'MANUAL' ? ' (by hand)' : ''}</Badge> : <Badge tone="warning">Not cleared{b.clearance?.source === 'MANUAL' ? ' (by hand)' : ''}</Badge>} />
        <CardBody className="flex flex-col gap-4 text-sm">
          <p>Due <span className="font-medium tabular-nums">{formatMoney(b.due, b.currency)}</span>, paid {b.percentPaid}%, balance <span className="font-semibold tabular-nums">{formatMoney(Math.max(0, b.balance), b.currency)}</span>{b.overpaid ? `, overpaid by ${formatMoney(b.overpaid, b.currency)}` : ''}. Clearance needs {b.clearancePercent}%.</p>
          {b.clearance?.source === 'MANUAL' && <p className="text-muted">Clearance was set by hand on the Fee clearance screen, so the fee rule does not change it.</p>}
          <ul className="flex flex-col gap-1">
            {b.lines.map((l) => <li key={l.name} className="flex justify-between"><span>{l.name}</span><span className="tabular-nums">{formatMoney(l.amount, b.currency)}</span></li>)}
            {b.adjustments.map((a) => <li key={a.id} className="flex justify-between text-muted"><span>{formatDate(a.createdAt)}: {a.reason}</span><span className="tabular-nums">{a.amount < 0 ? '-' : '+'}{formatMoney(Math.abs(a.amount), b.currency)}</span></li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode('payment')}>Record a payment</Button>
            <Button size="sm" variant="secondary" onClick={() => setMode('adjust')}>Waiver or charge</Button>
            <span className="self-center"><PdfLink api={`/fees/bills/${b.id}/statement/pdf`} label="Statement PDF" /></span>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Payments" />
        {b.payments.length === 0 ? <CardBody><p className="text-sm text-muted">None yet.</p></CardBody> : (
          <ul className="divide-y divide-border">
            {b.payments.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span>{formatDate(p.paidOn)}, {FEE_METHOD_LABEL[p.method]}, ref {p.reference}<span className="block text-xs text-muted"><Link href={`/finance/fees/receipts/${p.id}`} className="text-primary hover:underline">Receipt {p.receiptNumber}</Link>{p.originalAmount && p.originalCurrency ? `. Paid as ${formatMoney(p.originalAmount, p.originalCurrency)} at ${p.exchangeRate}` : ''}{p.reversedAt ? `. Reversed ${formatDate(p.reversedAt)}: ${p.reversalReason}` : ''}</span></span>
                <span className="flex items-center gap-2"><span className={`tabular-nums ${p.reversedAt ? 'text-muted line-through' : ''}`}>{formatMoney(p.amount, b.currency)}</span>{!p.reversedAt && p.method !== 'ONLINE' && <Button variant="ghost" size="sm" onClick={() => setMode({ reverse: p.id })}>Reverse</Button>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ActionDialog bill={b} mode={mode} onClose={() => setMode(null)} onDone={(x) => { setB(x); setMode(null); }} />
    </div>
  );
}

function ActionDialog({ bill, mode, onClose, onDone }: { bill: Bill; mode: Mode | null; onClose: () => void; onDone: (b: Bill) => void }) {
  const [f, setF] = useState({ paidCurrency: bill.currency as string, amount: '', method: 'BANK', reference: '', paidOn: new Date().toISOString().slice(0, 10), kind: 'WAIVER', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF({ paidCurrency: bill.currency, amount: '', method: 'BANK', reference: '', paidOn: new Date().toISOString().slice(0, 10), kind: 'WAIVER', reason: '' }); setError(null); }, [mode]);
  if (!mode) return null;
  const pesewas = Math.round(Number(f.amount) * 100);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'payment') onDone(await feesApi.recordPayment(bill.id, { amount: pesewas, method: f.method as 'BANK', reference: f.reference.trim(), paidOn: f.paidOn, paidCurrency: f.paidCurrency as 'GHS' | 'USD' }));
      else if (mode === 'adjust') onDone(await feesApi.adjust(bill.id, { amount: f.kind === 'WAIVER' ? -pesewas : pesewas, reason: f.reason.trim() }));
      else onDone(await feesApi.reverse(mode.reverse, f.reason.trim()));
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const title = mode === 'payment' ? 'Record a payment' : mode === 'adjust' ? 'Waiver or extra charge' : 'Reverse this payment?';
  const ok = mode === 'payment' ? pesewas > 0 && f.reference.trim().length >= 3 : mode === 'adjust' ? pesewas > 0 && f.reason.trim().length >= 5 : f.reason.trim().length >= 5;
  return (
    <Dialog open onClose={onClose} title={title} description={mode === 'payment' ? 'Enter it exactly as on the bank slip or transaction message. The same reference cannot be recorded twice.' : typeof mode === 'object' ? 'For a bounced cheque or a slip recorded against the wrong student. The record stays, marked reversed.' : 'The student sees the reason on their bill.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {mode === 'payment' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount (${f.paidCurrency === 'USD' ? 'US$' : 'GH₵'})`} htmlFor="fb-amt"><Input id="fb-amt" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="How" htmlFor="fb-m"><Select id="fb-m" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="BANK">Bank deposit</option><option value="MOBILE_MONEY">Mobile money to the university</option><option value="CHEQUE">Cheque</option></Select></Field>
            <Field label="Currency paid" htmlFor="fb-cur" hint={f.paidCurrency !== bill.currency ? (bill.cedisPerDollar ? `Converted at today's ${bill.cedisPerDollar} cedis per dollar (the rate on the payment date is used): about ${formatMoney(f.paidCurrency === 'GHS' ? Math.round(pesewas / bill.cedisPerDollar) : Math.round(pesewas * bill.cedisPerDollar), bill.currency)}.` : 'No exchange rate is set yet.') : undefined}>
              <Select id="fb-cur" value={f.paidCurrency} onChange={(e) => setF({ ...f, paidCurrency: e.target.value })}><option value="GHS">Cedis</option><option value="USD">US dollars</option></Select>
            </Field>
            <Field label="Slip, teller or transaction number" htmlFor="fb-ref"><Input id="fb-ref" value={f.reference} maxLength={60} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
            <Field label="Date paid" htmlFor="fb-date"><Input id="fb-date" type="date" max={new Date().toISOString().slice(0, 10)} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></Field>
          </div>
        )}
        {mode === 'adjust' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" htmlFor="fb-k"><Select id="fb-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="WAIVER">Scholarship or waiver (reduces the bill)</option><option value="CHARGE">Extra charge (adds to the bill)</option></Select></Field>
            <Field label={`Amount (${bill.currency === 'USD' ? 'US$' : 'GH₵'})`} htmlFor="fb-aamt"><Input id="fb-aamt" type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          </div>
        )}
        {mode !== 'payment' && <Field label="Reason" htmlFor="fb-reason"><Textarea id="fb-reason" value={f.reason} maxLength={300} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={typeof mode === 'object' ? 'danger' : 'primary'} loading={busy} disabled={!ok} onClick={submit}>{mode === 'payment' ? 'Record payment' : mode === 'adjust' ? 'Save' : 'Reverse payment'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
