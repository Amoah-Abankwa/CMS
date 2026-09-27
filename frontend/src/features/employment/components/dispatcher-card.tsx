'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DISPATCHER_STATUS_LABEL, formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth.store';
import { DISPATCHER_TONE, TRANSPORT_LABEL, workApi, type DispatcherApplication, type MyDispatcher, type Transport } from '../api';
import { EligibilityNote } from './eligibility-note';

/** The campus dispatcher programme: apply, see where your application stands, keep payout details current. */
export function DispatcherCard() {
  const [data, setData] = useState<MyDispatcher | null>(null);
  const [dialog, setDialog] = useState<'apply' | 'payout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => workApi.dispatcher().then(setData).catch((err) => setError(errorMessage(err))), []);
  useEffect(() => { void load(); }, [load]);

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const p = data.profile;
  const canApply = !p || p.status === 'REJECTED' || p.status === 'ENDED';
  return (
    <Card>
      <CardHeader
        title="Campus dispatcher"
        description={`Deliver food orders around campus between lectures and earn ${formatCedis(data.feePerDelivery)} for each delivery, paid to your mobile money.`}
        actions={p ? <Badge tone={DISPATCHER_TONE[p.status]}>{DISPATCHER_STATUS_LABEL[p.status]}</Badge> : undefined}
      />
      <CardBody className="flex flex-col gap-3">
        {p?.status === 'ACTIVE' && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dispatch" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:opacity-90">Open deliveries</Link>
            <Button variant="ghost" size="sm" onClick={() => setDialog('payout')}>Change payout details</Button>
          </div>
        )}
        {p?.status === 'PENDING' && <p className="text-sm">Career Services is looking at your application. You will get an email and SMS with the outcome.</p>}
        {p?.statusNote && p.status !== 'ACTIVE' && <p className="text-sm text-muted">Note: {p.statusNote}</p>}
        {canApply && (
          <>
            <EligibilityNote eligibility={data.eligibility} cgpa={data.eligibility.cgpa} />
            <div><Button size="sm" disabled={!data.eligibility.eligible} onClick={() => setDialog('apply')}>{p ? 'Apply again' : 'Apply to deliver'}</Button></div>
          </>
        )}
      </CardBody>
      <ApplyDialog mode={dialog} current={p} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); }} />
    </Card>
  );
}

function ApplyDialog({ mode, current, onClose, onDone }: { mode: 'apply' | 'payout' | null; current: MyDispatcher['profile']; onClose: () => void; onDone: () => void }) {
  const me = useAuthStore((s) => s.me);
  const [f, setF] = useState<DispatcherApplication>({ statement: '', transport: 'WALKING', payoutNetwork: 'MTN', payoutNumber: '', payoutName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!mode) return;
    setF({
      statement: current?.statement ?? '', transport: current?.transport ?? 'WALKING', payoutNetwork: current?.payoutNetwork ?? 'MTN',
      payoutNumber: current?.payoutNumber ?? me?.phone ?? '', payoutName: current?.payoutName ?? (me ? `${me.firstName} ${me.lastName}` : ''),
    });
    setError(null);
  }, [mode, current, me]);
  if (!mode) return null;
  const apply = mode === 'apply';
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (apply) await workApi.applyDispatcher(f);
      else await workApi.updatePayout(f);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={apply ? 'Apply to be a campus dispatcher' : 'Payout details'} description={apply ? 'Deliveries are paid online by customers, so you never carry cash.' : undefined}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {apply && <Field label="Why you would be good at this" htmlFor="dp-st"><Textarea id="dp-st" value={f.statement} maxLength={1000} onChange={(e) => setF({ ...f, statement: e.target.value })} placeholder="When you are free, which halls you know, anything else Career Services should know" /></Field>}
        <Field label="How you get around" htmlFor="dp-tr">
          <Select id="dp-tr" value={f.transport} onChange={(e) => setF({ ...f, transport: e.target.value as Transport })}>
            {(Object.keys(TRANSPORT_LABEL) as Transport[]).map((t) => <option key={t} value={t}>{TRANSPORT_LABEL[t]}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Network" htmlFor="dp-net">
            <Select id="dp-net" value={f.payoutNetwork} onChange={(e) => setF({ ...f, payoutNetwork: e.target.value })}>
              <option value="MTN">MTN MoMo</option>
              <option value="Telecel">Telecel Cash</option>
              <option value="AirtelTigo">AirtelTigo Money</option>
            </Select>
          </Field>
          <Field label="Mobile money number" htmlFor="dp-num"><Input id="dp-num" type="tel" value={f.payoutNumber} onChange={(e) => setF({ ...f, payoutNumber: e.target.value })} /></Field>
          <Field label="Name on the account" htmlFor="dp-name"><Input id="dp-name" value={f.payoutName} maxLength={80} onChange={(e) => setF({ ...f, payoutName: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={(apply && f.statement.trim().length < 20) || f.payoutNumber.trim().length < 9 || f.payoutName.trim().length < 3} onClick={save}>{apply ? 'Send application' : 'Save'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
