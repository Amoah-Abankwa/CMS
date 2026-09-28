'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { clockTime } from '@/features/marketplace/api';
import { dispatchApi, type DispatchState } from '@/features/employment/api';

type Mine = DispatchState['mine'][number];

/** The dispatcher's live screen. Refreshes every 15 seconds, which also keeps them online. */
export function DispatchBoard() {
  const [s, setS] = useState<DispatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ d: Mine; kind: 'deliver' | 'problem' } | null>(null);

  const load = useCallback(() => dispatchApi.state().then((x) => { setS(x); }).catch((err) => setError(errorMessage(err))), []);
  useEffect(() => {
    void load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!s) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const full = s.mine.length >= s.maxActive;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-medium">{s.profile.online ? 'You are online' : 'You are offline'}</span>
          {s.profile.online ? '. New deliveries appear below.' : '. Go online when you are free to deliver.'} Today: {s.today.deliveries} delivered, <span className="font-medium tabular-nums">{formatCedis(s.today.earned)}</span> earned.
        </p>
        <Button variant={s.profile.online ? 'secondary' : 'primary'} size="sm" loading={busy === 'online'} onClick={() => run('online', () => dispatchApi.setOnline(!s.profile.online))}>
          {s.profile.online ? 'Go offline' : 'Go online'}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {s.mine.map((d) => (
        <Card key={d.id}>
          <CardHeader
            title={`Order #${d.order.number}: ${d.status === 'ASSIGNED' ? 'collect from the vendor' : 'take to the customer'}`}
            description={`You earn ${formatCedis(d.fee)}`}
            actions={<Badge tone={d.status === 'ASSIGNED' ? 'warning' : 'primary'}>{d.status === 'ASSIGNED' ? 'To collect' : 'On the way'}</Badge>}
          />
          <CardBody className="flex flex-col gap-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted">Collect from</p>
                <p className="font-medium">{d.order.vendor.name}</p>
                <p>{d.order.vendor.location}</p>
                <a className="text-primary hover:underline" href={`tel:${d.order.vendor.phone}`}>{d.order.vendor.phone}</a>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Deliver to</p>
                <p className="font-medium">{d.order.customer.firstName} {d.order.customer.lastName}</p>
                <p>{d.order.deliveryAddress}{d.order.deliveryNote ? ` (${d.order.deliveryNote})` : ''}</p>
                {d.order.customer.phone && <a className="text-primary hover:underline" href={`tel:${d.order.customer.phone}`}>{d.order.customer.phone}</a>}
              </div>
            </div>
            <p className="text-muted">{d.order.items.map((i) => `${i.quantity} x ${i.name}`).join(', ')}. {d.feeSettlement === 'CUSTOMER' ? `Collect your fee of ${formatCedis(d.fee)} from the customer on delivery.` : d.feeSettlement === 'VENDOR' ? `The vendor hands you your fee of ${formatCedis(d.fee)} when you collect.` : 'Your fee is paid to you by Finance.'}</p>
            {d.problemNote && <Alert tone="warning">You reported: {d.problemNote}. The vendor has been told.</Alert>}
            <div className="flex flex-wrap gap-2">
              {d.status === 'ASSIGNED' ? (
                <>
                  <Button size="sm" loading={busy === d.id + 'pick'} onClick={() => run(d.id + 'pick', () => dispatchApi.pickedUp(d.id), `Order #${d.order.number} collected. The customer has been told you are on the way.`)}>I have collected it</Button>
                  <Button variant="ghost" size="sm" loading={busy === d.id + 'rel'} onClick={() => run(d.id + 'rel', () => dispatchApi.release(d.id), 'Handed back. Another dispatcher can take it.')}>Hand it back</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setDialog({ d, kind: 'deliver' })}>Delivered</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDialog({ d, kind: 'problem' })}>Report a problem</Button>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title="Waiting for a dispatcher" description={full ? `You are carrying ${s.maxActive}, the most at once. Finish one to take another.` : 'First to take a delivery gets it. The full address shows once you take it.'} />
        {!s.profile.online ? <CardBody><EmptyState title="You are offline" description="Go online to see deliveries." /></CardBody> : s.available.length === 0 ? <CardBody><EmptyState title="Nothing waiting" description="This page checks for new deliveries every 15 seconds." /></CardBody> : (
          <ul className="divide-y divide-border">
            {s.available.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{a.vendor.name}</span> to <span className="font-medium">{a.area}</span>
                  <span className="block text-xs text-muted">Collect at {a.vendor.location}. {a.items} {a.items === 1 ? 'item' : 'items'}. Ready since {clockTime(a.offeredAt)}.</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">{formatCedis(a.fee)}<span className="block text-xs font-normal text-muted">{a.feeSettlement === 'CUSTOMER' ? 'from the customer' : a.feeSettlement === 'VENDOR' ? 'from the vendor' : 'paid by Finance'}</span></span>
                  <Button size="sm" disabled={full} loading={busy === a.id} onClick={() => run(a.id, () => dispatchApi.take(a.id), `Order #${a.number} is yours. Go to ${a.vendor.name}.`)}>Take it</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DeliveryDialog target={dialog} onClose={() => setDialog(null)} onDone={(msg) => { setDialog(null); setNotice(msg); void load(); }} />
    </div>
  );
}

function DeliveryDialog({ target, onClose, onDone }: { target: { d: Mine; kind: 'deliver' | 'problem' } | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(''); setError(null); }, [target]);
  if (!target) return null;
  const { d, kind } = target;
  const deliver = kind === 'deliver';
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (deliver) {
        const r = await dispatchApi.delivered(d.id, value);
        onDone(`Delivered. You earned ${formatCedis(r.earned)}.`);
      } else {
        await dispatchApi.problem(d.id, value.trim());
        onDone('The vendor has been told and will contact you.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={deliver ? `Deliver order #${d.order.number}` : `Problem with order #${d.order.number}`}
      description={deliver ? `Ask ${d.order.customer.firstName} for the 4-digit code on their order. Only hand over the food once the code is accepted.` : 'For example: the customer is not answering, or the address is wrong. The vendor decides what happens next.'}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {deliver ? (
          <Field label="Customer's code" htmlFor="dl-code"><Input id="dl-code" autoFocus inputMode="numeric" maxLength={4} className="font-mono text-2xl tracking-[0.3em]" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /></Field>
        ) : (
          <Field label="What is wrong" htmlFor="dl-note"><Textarea id="dl-note" value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} /></Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Back</Button>
          <Button loading={busy} disabled={deliver ? value.length !== 4 : value.trim().length < 5} onClick={submit}>{deliver ? 'Confirm delivery' : 'Tell the vendor'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
