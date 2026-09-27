'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, PERMISSIONS } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { FINE_REASON, libraryApi, PAYMENT_METHOD, type FineRow } from '../api';

const PAGE_SIZE = 25;

export function FinesManager() {
  const canWaive = useAuthStore((s) => s.can(PERMISSIONS.LIBRARY_MANAGE));
  const [status, setStatus] = useState('OUTSTANDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: FineRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, setPaying] = useState<FineRow | null>(null);
  const [waiving, setWaiving] = useState<FineRow | null>(null);

  const load = useCallback(() => libraryApi.fines({ status, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))), [status, search, page]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
        <Select aria-label="Show" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="OUTSTANDING">Still owed</option>
          <option value="SETTLED">Settled</option>
          <option value="ALL">All</option>
        </Select>
        <Input type="search" aria-label="Search" placeholder="Search borrower" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title={status === 'OUTSTANDING' ? 'Nobody owes a fine' : 'No fines here'} /> : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{f.borrower.firstName} {f.borrower.lastName}</span> <span className="text-xs text-muted">{f.borrower.indexNumber ?? f.borrower.email}</span>
                  <span className="block text-xs text-muted">{FINE_REASON[f.reason]}{f.note ? `: ${f.note}` : ''}. Charged {formatDateTime(f.createdAt)}.</span>
                  {f.payments.length > 0 && (
                    <span className="block text-xs text-muted">{f.payments.map((p) => `${PAYMENT_METHOD[p.method]} ${formatCedis(p.amount)}${p.receiptNumber ? ` (receipt ${p.receiptNumber})` : ''}${p.note ? ` (${p.note})` : ''}`).join('; ')}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {f.settledAt ? <Badge tone="success">Settled</Badge> : <span className="font-medium tabular-nums">{formatCedis(f.outstanding)}</span>}
                  {!f.settledAt && <Button size="sm" onClick={() => setPaying(f)}>Take payment</Button>}
                  {!f.settledAt && canWaive && <Button variant="ghost" size="sm" onClick={() => setWaiving(f)}>Waive</Button>}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3"><Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} /></div>
        </div>
      )}
      <PayDialog fine={paying} onClose={() => setPaying(null)} onDone={(m) => { setPaying(null); setNotice(m); void load(); }} />
      <WaiveDialog fine={waiving} onClose={() => setWaiving(null)} onDone={(m) => { setWaiving(null); setNotice(m); void load(); }} />
    </div>
  );
}

function PayDialog({ fine, onClose, onDone }: { fine: FineRow | null; onClose: () => void; onDone: (m: string) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'MOBILE_MONEY'>('CASH');
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (fine) { setAmount(String(fine.outstanding / 100)); setMethod('CASH'); setReceipt(''); setError(null); } }, [fine]);
  if (!fine) return null;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await libraryApi.pay(fine.id, Math.round(Number(amount) * 100), method, receipt.trim() || undefined);
      onDone(r.remaining ? `Payment recorded. ${formatCedis(r.remaining)} still owed on this fine.` : 'Paid in full.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={`Payment from ${fine.borrower.firstName} ${fine.borrower.lastName}`} description={`${formatCedis(fine.outstanding)} owed on this fine.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received (GH₵)" htmlFor="pay-amt"><Input id="pay-amt" type="number" inputMode="decimal" step="0.01" min={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Paid by" htmlFor="pay-method">
            <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as 'CASH')}>
              <option value="CASH">Cash</option>
              <option value="MOBILE_MONEY">Mobile money</option>
            </Select>
          </Field>
        </div>
        <Field label="Receipt or transaction number" htmlFor="pay-receipt" hint="Ties this payment to the Finance Office's records."><Input id="pay-receipt" value={receipt} maxLength={40} onChange={(e) => setReceipt(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!(Number(amount) > 0)} onClick={save}>Record payment</Button>
        </div>
      </div>
    </Dialog>
  );
}

function WaiveDialog({ fine, onClose, onDone }: { fine: FineRow | null; onClose: () => void; onDone: (m: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (fine) { setAmount(String(fine.outstanding / 100)); setReason(''); setError(null); } }, [fine]);
  if (!fine) return null;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await libraryApi.waive(fine.id, reason.trim(), Math.round(Number(amount) * 100));
      onDone(r.remaining ? `Waived in part. ${formatCedis(r.remaining)} still owed.` : 'Fine waived.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title="Waive a fine" description={`${fine.borrower.firstName} ${fine.borrower.lastName}, ${formatCedis(fine.outstanding)} owed. Recorded in the activity log.`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Amount to waive (GH₵)" htmlFor="w-amt"><Input id="w-amt" type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reason" htmlFor="w-reason" hint="For example: lost book was found and returned."><Textarea id="w-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 5 || !(Number(amount) > 0)} onClick={save}>Waive</Button>
        </div>
      </div>
    </Dialog>
  );
}
