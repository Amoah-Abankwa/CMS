'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FEE_METHOD_LABEL, formatMoney } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { feesApi, type MyBill } from '../api';
import { PdfLink } from './pdf-link';
import { usePaymentReturn } from './use-payment-return';

export function MyFees() {
  const [data, setData] = useState<Awaited<ReturnType<typeof feesApi.mine>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<MyBill | null>(null);
  const load = useCallback(() => { feesApi.mine().then(setData).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  const notice = usePaymentReturn(load);

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!data.bills.length) return <EmptyState title="No fees yet" description="Your bill appears here once the Finance Office issues this semester's fees." />;
  const pct = data.rules.clearancePercent;

  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {data.bills.map((b, i) => (
        <Card key={b.id}>
          <CardHeader title={b.semesterLabel} description={`Issued ${formatDate(b.issuedAt)}`} actions={b.cleared ? <Badge tone="success">Cleared for exams</Badge> : b.balance <= 0 ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">{b.percentPaid}% paid</Badge>} />
          <CardBody className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label="Total due" value={formatMoney(b.due, b.currency)} />
              <Figure label="Paid" value={formatMoney(b.due - Math.max(0, b.balance), b.currency)} />
              <Figure label="Balance" value={formatMoney(Math.max(0, b.balance), b.currency)} strong />
            </div>
            {i === 0 && !b.cleared && b.balance > 0 && (
              <div>
                <div className="h-2 overflow-hidden rounded-sm bg-surface-muted" role="progressbar" aria-valuenow={b.percentPaid} aria-valuemin={0} aria-valuemax={100} aria-label="Percentage paid">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, b.percentPaid)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">Pay at least {pct}% ({formatMoney(Math.ceil((b.due * pct) / 100), b.currency)}) to be cleared for exams. Clearance is automatic once the payment is recorded.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-4"><Link href={`/fees/statement/${b.id}`} className="text-sm text-primary hover:underline">Statement (debits, credits and balance)</Link><PdfLink api={`/me/fees/statements/${b.id}/pdf`} label="Statement as PDF" /></div>
            {b.currency === 'USD' && data.cedisPerDollar && b.balance > 0 && <p className="text-xs text-muted">At today&apos;s rate ({data.cedisPerDollar} cedis per dollar) the balance is {formatMoney(Math.round(b.balance * data.cedisPerDollar), 'GHS')}. You can pay in cedis at the bank; the Finance Office converts it at the rate on the day you pay.</p>}
            {b.balance > 0 && <div className="flex flex-wrap gap-2"><Button onClick={() => setPaying(b)}>Pay online</Button><p className="self-center text-xs text-muted">Or pay at the bank; the Finance Office records it against your bill.</p></div>}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">What the bill is made of</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {b.lines.map((l) => <li key={l.name} className="flex justify-between"><span>{l.name}</span><span className="tabular-nums">{formatMoney(l.amount, b.currency)}</span></li>)}
                {b.adjustments.map((a) => <li key={a.id} className="flex justify-between text-muted"><span>{a.amount < 0 ? 'Less: ' : 'Add: '}{a.reason}</span><span className="tabular-nums">{a.amount < 0 ? '-' : ''}{formatMoney(Math.abs(a.amount), b.currency)}</span></li>)}
              </ul>
            </details>
            {b.payments.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-medium">Payments</h3>
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 px-3 py-2">
                      <span>{formatDate(p.paidOn)}, {FEE_METHOD_LABEL[p.method]}<span className="block text-xs text-muted"><Link href={`/fees/receipts/${p.id}`} className="text-primary hover:underline">Receipt {p.receiptNumber}</Link> <PdfLink api={`/me/fees/receipts/${p.id}/pdf`} label="PDF" />{p.reversedAt ? `. Reversed: ${p.reversalReason}` : ''}</span></span>
                      <span className={`tabular-nums ${p.reversedAt ? 'line-through text-muted' : ''}`}>{formatMoney(p.amount, b.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      ))}
      <PayDialog bill={paying} min={paying?.currency === 'USD' ? data.rules.minOnlinePaymentUsd : data.rules.minOnlinePayment} testMode={data.provider === 'demo'} onClose={() => setPaying(null)} />
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-md border border-border px-3 py-2"><p className="text-xs text-muted">{label}</p><p className={`tabular-nums ${strong ? 'text-lg font-semibold' : ''}`}>{value}</p></div>;
}

function PayDialog({ bill, min, testMode, onClose }: { bill: MyBill | null; min: number; testMode: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (bill) { setAmount(String(Math.max(0, bill.balance) / 100)); setError(null); } }, [bill]);
  if (!bill) return null;
  const pesewas = Math.round(Number(amount) * 100);
  const floor = Math.min(min, bill.balance);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await feesApi.pay(bill.id, pesewas);
      window.location.href = r.paymentUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="Pay fees online" description={`Balance ${formatMoney(bill.balance, bill.currency)}. Pay all of it or part of it, by mobile money or card.${testMode ? ' This is the demo checkout: no money moves.' : ''}`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={`Amount (${bill.currency === 'USD' ? 'US$' : 'GH₵'})`} htmlFor="fee-amt" hint={`At least ${formatMoney(floor, bill.currency)}.${bill.currency === 'USD' ? ' Dollar card payments depend on the university’s Paystack account; otherwise pay at the bank.' : ''}`}><Input id="fee-amt" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!(pesewas >= floor && pesewas <= bill.balance)} onClick={go}>Pay {pesewas > 0 ? formatMoney(pesewas, bill.currency) : ''}</Button>
        </div>
      </div>
    </Dialog>
  );
}
