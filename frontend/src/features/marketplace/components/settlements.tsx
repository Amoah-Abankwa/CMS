'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { PayNowButton } from '@/features/fees/components/pay-now';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { downloadCsv } from '@/lib/csv';
import { foodApi, type DispatcherSettlement, type Settlement } from '../api';

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** What the university owes each vendor for online orders, and payouts made. */
export function Settlements() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 6 * 86_400_000)));
  const [to, setTo] = useState(iso(today));
  const [rows, setRows] = useState<Settlement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Settlement | null>(null);

  const range = useCallback(() => ({ from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }), [from, to]);
  const load = useCallback(() => {
    setRows(null);
    const r = range();
    foodApi.settlements(r.from, r.to).then(setRows).catch((err) => setError(errorMessage(err)));
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!rows) return;
    downloadCsv(`vendor-settlements-${from}-to-${to}.csv`, [
      ['Vendor', 'Online orders', 'Online sales (GHS)', 'Commission (GHS)', 'Dispatcher fees (GHS)', 'Net (GHS)', 'Paid out (GHS)', 'Owed (GHS)', 'Counter orders', 'Counter sales (GHS)', 'Payout network', 'Payout number', 'Payout name'],
      ...rows.map((r) => [r.vendor.name, r.onlineOrders, r.onlineGross / 100, r.commission / 100, r.dispatchFees / 100, r.net / 100, r.paidOut / 100, r.owed / 100, r.counterOrders, r.counterGross / 100, r.vendor.payoutNetwork ?? '', r.vendor.payoutNumber ?? '', r.vendor.payoutName ?? '']),
    ]);
  };
  const totalOwed = rows?.reduce((s, r) => s + Math.max(0, r.owed), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title="Period" description="Completed orders in these dates. Payouts count if recorded for a period inside these dates." actions={rows && rows.length > 0 ? <Button variant="secondary" size="sm" onClick={exportCsv}>Download CSV</Button> : undefined} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="st-from"><Input id="st-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="st-to"><Input id="st-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        </CardBody>
      </Card>

      {!rows ? <Spinner /> : rows.length === 0 ? <EmptyState title="No vendors" /> : (
        <Card>
          <CardHeader title={`Owed to vendors: ${formatCedis(totalOwed)}`} description="Pay-at-counter sales go straight to vendors and are shown for reference only." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 text-right font-medium">Online sales</th>
                  <th className="px-3 py-2 text-right font-medium">Commission</th>
                  <th className="px-3 py-2 text-right font-medium">Dispatcher fees</th>
                  <th className="px-3 py-2 text-right font-medium">Paid out</th>
                  <th className="px-3 py-2 text-right font-medium">Owed</th>
                  <th className="px-3 py-2 text-right font-medium">Counter sales</th>
                  <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.vendor.id}>
                    <td className="px-4 py-2">{r.vendor.name}<span className="block text-xs text-muted">{r.vendor.payoutNumber ? `${r.vendor.payoutNetwork} ${r.vendor.payoutNumber}, ${r.vendor.payoutName ?? ''}` : 'No payout number'}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCedis(r.onlineGross)}<span className="block text-xs text-muted">{r.onlineOrders} orders</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCedis(r.commission)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCedis(r.dispatchFees)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCedis(r.paidOut)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCedis(r.owed)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{formatCedis(r.counterGross)}<span className="block text-xs">{r.counterOrders} orders</span></td>
                    <td className="px-4 py-2 text-right">{r.owed > 0 && <span className="inline-flex items-start gap-2"><PayNowButton purpose="VENDOR" subjectId={r.vendor.id} amount={r.owed} label={r.vendor.name} period={range()} onDone={load} /><Button variant="secondary" size="sm" onClick={() => setPaying(r)}>Record payout</Button></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <PayoutDialog target={paying} period={range()} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />
      <DispatcherSettlements period={range()} />
    </div>
  );
}

/** Campus dispatchers, paid per delivery. The fees shown above come out of vendors' shares. */
function DispatcherSettlements({ period }: { period: { from: string; to: string } }) {
  const [rows, setRows] = useState<DispatcherSettlement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<DispatcherSettlement | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const { from, to } = period;
  const load = useCallback(() => {
    setRows(null);
    foodApi.dispatcherSettlements(from, to).then(setRows).catch((err) => setError(errorMessage(err)));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const open = (r: DispatcherSettlement) => { setPaying(r); setAmount(String(r.owed / 100)); setReference(''); setError(null); };
  const pay = async () => {
    if (!paying) return;
    setBusy(true);
    try {
      await foodApi.recordDispatcherPayout({ dispatcherId: paying.id, periodFrom: from, periodTo: to, amount: Math.round(Number(amount) * 100), reference: reference.trim() || undefined });
      setPaying(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Campus dispatchers" description="Deliveries in these dates, and what is owed to each dispatcher overall. The student is told by SMS when you record a payout." />
      {error && !paying && <CardBody><Alert tone="danger">{error}</Alert></CardBody>}
      {!rows ? <CardBody><Spinner /></CardBody> : rows.length === 0 ? <CardBody><EmptyState title="No dispatcher deliveries" /></CardBody> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Dispatcher</th>
                <th className="px-3 py-2 text-right font-medium">Deliveries</th>
                <th className="px-3 py-2 text-right font-medium">Earned</th>
                <th className="px-3 py-2 text-right font-medium">Owed</th>
                <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.student.firstName} {r.student.lastName} <span className="text-muted">{r.student.indexNumber}</span><span className="block text-xs text-muted">{r.payoutNetwork} {r.payoutNumber}, {r.payoutName}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.deliveries}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCedis(r.earned)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCedis(r.owed)}</td>
                  <td className="px-4 py-2 text-right">{r.owed > 0 && <span className="inline-flex items-start gap-2"><PayNowButton purpose="DISPATCHER" subjectId={r.id} amount={r.owed} label={`${r.student.firstName} ${r.student.lastName}`} period={period} onDone={() => window.location.reload()} /><Button variant="secondary" size="sm" onClick={() => open(r)}>Record payout</Button></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paying && (
        <Dialog open onClose={() => setPaying(null)} title={`Record payout to ${paying.student.firstName} ${paying.student.lastName}`} description="Record a mobile money payment you have already sent. This does not send money.">
          <div className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm">{paying.payoutNetwork} {paying.payoutNumber}, {paying.payoutName}</p>
            <Field label="Amount (GH₵)" htmlFor="dpo-amt"><Input id="dpo-amt" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Transaction ID (optional)" htmlFor="dpo-ref"><Input id="dpo-ref" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button>
              <Button loading={busy} disabled={!(Number(amount) > 0)} onClick={pay}>Record payout</Button>
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

function PayoutDialog({ target, period, onClose, onDone }: { target: Settlement | null; period: { from: string; to: string }; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (target) { setAmount(String(target.owed / 100)); setReference(''); setError(null); } }, [target]);
  if (!target) return null;
  const save = async () => {
    setBusy(true);
    try {
      await foodApi.recordPayout({ vendorId: target.vendor.id, periodFrom: period.from, periodTo: period.to, amount: Math.round(Number(amount) * 100), reference: reference.trim() || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Record payout to ${target.vendor.name}`} description="Record a payment you have already sent. This does not send money.">
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-sm">{target.vendor.payoutNumber ? `${target.vendor.payoutNetwork} ${target.vendor.payoutNumber}, ${target.vendor.payoutName ?? ''}` : 'The vendor has not added a payout number.'}</p>
        <Field label="Amount (GH₵)" htmlFor="po-amt"><Input id="po-amt" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Transaction ID (optional)" htmlFor="po-ref"><Input id="po-ref" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!(Number(amount) > 0)} onClick={save}>Record payout</Button>
        </div>
      </div>
    </Dialog>
  );
}
