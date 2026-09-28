'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { usePaymentReturn } from '@/features/fees/components/use-payment-return';

type Method = 'ONLINE' | 'CASH' | 'MOBILE_MONEY' | 'BANK';
const METHOD: Record<Method, string> = { ONLINE: 'Online', CASH: 'Cash', MOBILE_MONEY: 'MoMo', BANK: 'Bank' };
interface Fee {
  id: string; description: string; amount: number; paid: number; balance: number;
  hostel: { name: string; kind: 'UNIVERSITY' | 'PRIVATE' };
  student: { id: string; firstName: string; lastName: string; indexNumber: string | null; phone: string | null };
  payments: Array<{ id: string; amount: number; method: Method; receiptNumber: string; paidOn: string; reversedAt: string | null; reversalReason: string | null }>;
}
const pdf = (id: string) => `/api/v1/hostel-fees/payments/${id}/pdf`;

/** A student's hostel fees: pay online, see payments, download receipts. */
export function MyHostelFees() {
  const [data, setData] = useState<{ provider: string; fees: Fee[] } | null>(null);
  const [paying, setPaying] = useState<Fee | null>(null);
  const load = useCallback(() => { api.get<{ provider: string; fees: Fee[] }>('/hostel-fees/mine').then((r) => setData(r.data)).catch(() => setData({ provider: 'demo', fees: [] })); }, []);
  useEffect(() => { load(); }, [load]);
  const notice = usePaymentReturn(load);
  if (!data) return <Spinner />;
  if (!data.fees.length) return null;
  return (
    <Card>
      <CardHeader title="Hostel fees" description="Pay online, or in cash or MoMo to the Hostel Manager (university halls) or the owner (private hostels). Every payment gets a receipt." />
      <CardBody className="flex flex-col gap-3">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {data.fees.map((f) => (
          <div key={f.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{f.description}</span>
              {f.amount === 0 ? <Badge>Place given up</Badge> : f.balance <= 0 ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">{formatCedis(f.balance)} owed</Badge>}
            </div>
            <p className="text-muted">Fees {formatCedis(f.amount)}, paid {formatCedis(f.paid)}.{f.balance < 0 ? ` ${formatCedis(-f.balance)} to be refunded to you.` : ''}</p>
            {f.payments.length > 0 && (
              <ul className="flex flex-col gap-1">
                {f.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2"><span>{formatDate(p.paidOn)}, {METHOD[p.method]}, receipt {p.receiptNumber} <a className="text-primary hover:underline" href={pdf(p.id)} download>PDF</a>{p.reversedAt ? ` (reversed: ${p.reversalReason})` : ''}</span><span className={`tabular-nums ${p.reversedAt ? 'text-muted line-through' : ''}`}>{formatCedis(p.amount)}</span></li>)}
              </ul>
            )}
            {f.balance > 0 && <div><Button size="sm" onClick={() => setPaying(f)}>Pay online</Button></div>}
          </div>
        ))}
      </CardBody>
      {paying && <PayDialog fee={paying} testMode={data.provider === 'demo'} onClose={() => setPaying(null)} />}
    </Card>
  );
}

function PayDialog({ fee, testMode, onClose }: { fee: Fee; testMode: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(String(fee.balance / 100));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pesewas = Math.round(Number(amount) * 100);
  return (
    <Dialog open onClose={onClose} title="Pay hostel fees online" description={`${fee.description}. Balance ${formatCedis(fee.balance)}.${testMode ? ' Demo checkout: no money moves.' : ''}`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Amount (GH₵)" htmlFor="hf-a"><Input id="hf-a" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!(pesewas >= 100 && pesewas <= fee.balance)} onClick={async () => { setBusy(true); try { const r = await api.post<{ paymentUrl: string }>(`/hostel-fees/${fee.id}/pay`, { amount: pesewas }); window.location.href = r.data.paymentUrl; } catch (err) { setError(errorMessage(err)); setBusy(false); } }}>Pay {pesewas > 0 ? formatCedis(pesewas) : ''}</Button></div>
      </div>
    </Dialog>
  );
}

/** The Hostel Manager's (university halls) or an owner's (their private hostels) fees desk. */
export function HostelFeesDesk() {
  const [data, setData] = useState<{ rows: Fee[]; totals: { due: number; paid: number } } | null>(null);
  const [q, setQ] = useState({ search: '', unpaidOnly: false });
  const [dlg, setDlg] = useState<{ fee: Fee; kind: 'record' } | { paymentId: string; kind: 'reverse' } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get('/hostel-fees', { params: q }).then((r) => setData(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, [q]);
  useEffect(() => { const t = window.setTimeout(load, 250); return () => window.clearTimeout(t); }, [load]);
  if (!data) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <p className="text-sm text-muted">This semester: {formatCedis(data.totals.due)} due, {formatCedis(data.totals.paid)} paid. You receive a copy of every receipt.</p>
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Search" className="w-64" placeholder="Index number or name" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={q.unpaidOnly} onChange={(e) => setQ({ ...q, unpaidOnly: e.target.checked })} /> Only those who owe</label>
      </div>
      {data.rows.length === 0 ? <EmptyState title="No hostel fees" /> : (
        <Card>
          <ul className="divide-y divide-border">
            {data.rows.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{f.student.firstName} {f.student.lastName}</span> <span className="text-muted">{f.student.indexNumber}, {f.description}. {f.student.phone ?? ''}</span></span>
                  <span className="flex items-center gap-2">{f.balance > 0 ? <Badge tone="warning">{formatCedis(f.balance)} owed</Badge> : f.amount > 0 ? <Badge tone="success">Paid</Badge> : <Badge>Given up</Badge>}{f.balance > 0 && <Button size="sm" onClick={() => setDlg({ fee: f, kind: 'record' })}>Record payment</Button>}</span>
                </div>
                {f.payments.length > 0 && <p className="text-xs text-muted">{f.payments.map((p) => `${formatDate(p.paidOn)} ${METHOD[p.method]} ${formatCedis(p.amount)} (${p.receiptNumber}${p.reversedAt ? ', reversed' : ''})`).join('; ')}</p>}
                <span className="flex flex-wrap gap-3 text-xs">
                  {f.payments.filter((p) => !p.reversedAt).map((p) => <span key={p.id} className="flex gap-2"><a className="text-primary hover:underline" href={pdf(p.id)} download>Receipt {p.receiptNumber}</a>{p.method !== 'ONLINE' && <button className="text-muted hover:underline" onClick={() => setDlg({ paymentId: p.id, kind: 'reverse' })}>reverse</button>}</span>)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {dlg && <DeskDialog dlg={dlg} onClose={() => setDlg(null)} onDone={(t) => { setDlg(null); setMsg({ tone: 'success', text: t }); load(); }} />}
    </div>
  );
}

function DeskDialog({ dlg, onClose, onDone }: { dlg: { fee: Fee; kind: 'record' } | { paymentId: string; kind: 'reverse' }; onClose: () => void; onDone: (t: string) => void }) {
  const [f, setF] = useState({ amount: dlg.kind === 'record' ? String(dlg.fee.balance / 100) : '', method: 'CASH', reference: '', paidOn: new Date().toISOString().slice(0, 10), reason: '' });
  const [error, setError] = useState<string | null>(null);
  const record = dlg.kind === 'record';
  const submit = async () => {
    setError(null);
    try {
      if (record) { await api.post(`/hostel-fees/${dlg.fee.id}/payments`, { amount: Math.round(Number(f.amount) * 100), method: f.method, reference: f.reference.trim() || undefined, paidOn: f.paidOn }); onDone('Payment recorded. The student has been sent the receipt.'); }
      else { await api.post(`/hostel-fees/payments/${dlg.paymentId}/reverse`, { reason: f.reason.trim() }); onDone('Payment reversed.'); }
    } catch (err) { setError(errorMessage(err)); }
  };
  return (
    <Dialog open onClose={onClose} title={record ? `Payment from ${dlg.fee.student.firstName} ${dlg.fee.student.lastName}` : 'Reverse this payment?'} description={record ? dlg.fee.description : 'For a payment recorded against the wrong student or by mistake. The record stays, marked reversed.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {record ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (GH₵)" htmlFor="hd-a"><Input id="hd-a" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="How" htmlFor="hd-m"><Select id="hd-m" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="CASH">Cash</option><option value="MOBILE_MONEY">MoMo</option><option value="BANK">Bank deposit</option></Select></Field>
            {f.method !== 'CASH' && <Field label="Transaction ID" htmlFor="hd-r"><Input id="hd-r" value={f.reference} maxLength={60} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>}
            <Field label="Date paid" htmlFor="hd-d"><Input id="hd-d" type="date" max={new Date().toISOString().slice(0, 10)} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></Field>
          </div>
        ) : <Field label="Reason" htmlFor="hd-why"><Textarea id="hd-why" value={f.reason} maxLength={300} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={record ? 'primary' : 'danger'} disabled={record ? !(Number(f.amount) > 0) || (f.method !== 'CASH' && f.reference.trim().length < 3) : f.reason.trim().length < 5} onClick={submit}>{record ? 'Record payment' : 'Reverse'}</Button></div>
      </div>
    </Dialog>
  );
}

/** Finance: online private hostel fees collected, and payouts to owners. */
export function HostelOwnerPayouts() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; owner: { firstName: string; lastName: string; phone: string | null } | null; online: number; paidOut: number; owed: number }> | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const load = useCallback(() => { api.get('/fees/hostel-owners').then((r) => setRows(r.data)).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }, []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : <Spinner />;
  return (
    <Card>
      <CardHeader title="Private hostel owners" description="Online hostel fees are collected by the university and paid out to owners. Cash and MoMo paid to owners directly is not included." />
      {msg && <div className="px-4 pb-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {rows.length === 0 ? <CardBody><EmptyState title="No private hostels" /></CardBody> : (
        <ul className="divide-y divide-border">
          {rows.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{h.name}</span><span className="block text-xs text-muted">{h.owner ? `${h.owner.firstName} ${h.owner.lastName}, ${h.owner.phone ?? ''}. ` : ''}Online {formatCedis(h.online)}, paid out {formatCedis(h.paidOut)}.</span></span>
              <span className="flex items-center gap-3"><span className="font-medium tabular-nums">{formatCedis(h.owed)} owed</span>{h.owed > 0 && <Button size="sm" variant="secondary" onClick={() => { const ref = window.prompt(`Transaction ID for the ${formatCedis(h.owed)} payout to ${h.name} (optional)`) ?? undefined; api.post('/fees/hostel-owners/payouts', { hostelId: h.id, amount: h.owed, reference: ref || undefined }).then(() => { setMsg({ tone: 'success', text: `Payout to ${h.name} recorded.` }); load(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }}>Record payout</Button>}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
