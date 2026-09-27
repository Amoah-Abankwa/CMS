'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis, ORDER_STATUS_LABEL } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { clockTime, foodApi, STATUS_TONE, type Board, type Order } from '../api';

const COLUMNS = [
  { key: 'PLACED', title: 'New' },
  { key: 'ACCEPTED', title: 'Preparing' },
  { key: 'OUT', title: 'Ready or on the way' },
] as const;

/** The vendor's live board. Refreshes every 10 seconds. */
export function OrdersBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ order: Order; kind: 'reject' | 'cancel' | 'complete' } | null>(null);

  const load = useCallback(() => foodApi.board().then((b) => { setBoard(b); setError(null); }).catch((err) => setError(errorMessage(err))), []);
  useEffect(() => {
    void load();
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  const act = async (order: Order, to: string, extra: { reason?: string; code?: string } = {}) => {
    setBusy(order.id + to);
    try {
      await foodApi.act(order.id, to, extra);
      setDialog(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async () => {
    if (!board) return;
    await foodApi.pause(!board.vendor.paused).catch((err) => setError(errorMessage(err)));
    await load();
  };

  if (!board) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const column = (key: (typeof COLUMNS)[number]['key']) => board.active.filter((o) => (key === 'OUT' ? o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY' : o.status === key));

  return (
    <div className="flex flex-col gap-4">
      {board.vendor.status !== 'APPROVED' && <Alert tone="warning">Your shop is {board.vendor.status.toLowerCase()} and not visible to customers yet.</Alert>}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-medium">{board.vendor.openNow ? 'Taking orders' : board.vendor.paused ? 'Paused' : 'Closed (outside opening hours)'}</span>. Sales completed today: <span className="font-medium tabular-nums">{formatCedis(board.salesToday)}</span>.
        </p>
        <Button variant={board.vendor.paused ? 'primary' : 'secondary'} size="sm" onClick={togglePause}>{board.vendor.paused ? 'Start taking orders' : 'Pause new orders'}</Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((c) => {
          const orders = column(c.key);
          return (
            <section key={c.key} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{c.title} ({orders.length})</h2>
              {orders.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">None</p> : orders.map((o) => (
                <article key={o.id} className={cn('rounded-lg border bg-surface px-3 py-3', o.status === 'PLACED' ? 'border-primary' : 'border-border')}>
                  <header className="flex items-start justify-between gap-2">
                    <span className="font-semibold">#{o.number}</span>
                    <span className="text-xs text-muted">{o.placedAt ? clockTime(o.placedAt) : ''}</span>
                  </header>
                  <p className="text-sm">{o.customer.firstName} {o.customer.lastName}{o.customer.phone ? `, ${o.customer.phone}` : ''}</p>
                  <ul className="my-2 text-sm">{o.items.map((i, n) => <li key={n}>{i.quantity} x {i.name}</li>)}</ul>
                  {o.note && <p className="rounded bg-warning-soft px-2 py-1 text-xs">Note: {o.note}</p>}
                  {o.viaDispatcher && <DispatchLine order={o} />}
                  <p className="mt-1 text-xs text-muted">
                    {o.fulfilment === 'DELIVERY' ? `Deliver to ${o.deliveryAddress}${o.deliveryNote ? ` (${o.deliveryNote})` : ''}` : 'Pickup'}. {formatCedis(o.total)}, {o.paymentOption === 'ONLINE' ? 'paid online' : 'collect payment'}.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === 'PLACED' && (
                      <>
                        <Button size="sm" loading={busy === o.id + 'ACCEPTED'} onClick={() => act(o, 'ACCEPTED').catch(() => undefined)}>Accept</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDialog({ order: o, kind: 'reject' })}>Decline</Button>
                      </>
                    )}
                    {o.status === 'ACCEPTED' && (
                      <Button size="sm" loading={busy === o.id + 'READY' || busy === o.id + 'OUT_FOR_DELIVERY'} onClick={() => act(o, o.fulfilment === 'PICKUP' || o.viaDispatcher ? 'READY' : 'OUT_FOR_DELIVERY').catch(() => undefined)}>
                        {o.viaDispatcher ? 'Ready for a dispatcher' : o.fulfilment === 'PICKUP' ? 'Ready for pickup' : 'Sent for delivery'}
                      </Button>
                    )}
                    {o.viaDispatcher && o.status === 'READY' && o.delivery?.status === 'WAITING' && (
                      <Button variant="secondary" size="sm" loading={busy === o.id + 'OUT_FOR_DELIVERY'} onClick={() => act(o, 'OUT_FOR_DELIVERY').catch(() => undefined)}>Send with our own staff</Button>
                    )}
                    {(o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY') && (!o.viaDispatcher || o.delivery?.status === 'CANCELLED') && <Button size="sm" onClick={() => setDialog({ order: o, kind: 'complete' })}>Handed over</Button>}
                    {o.status !== 'PLACED' && <Button variant="ghost" size="sm" onClick={() => setDialog({ order: o, kind: 'cancel' })}>Cancel</Button>}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Finished today ({board.done.length})</h2>
        {board.done.length === 0 ? <EmptyState title="Nothing yet today" /> : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {board.done.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>#{o.number} {o.customer.firstName} {o.customer.lastName}<span className="block text-xs text-muted">{o.items.map((i) => `${i.quantity} x ${i.name}`).join(', ')}</span></span>
                <span className="flex items-center gap-2"><span className="tabular-nums">{formatCedis(o.total)}</span><Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionDialog target={dialog} onClose={() => setDialog(null)} onSubmit={(value) => {
        if (!dialog) return Promise.resolve();
        const { order, kind } = dialog;
        return kind === 'complete' ? act(order, 'COMPLETED', { code: value }) : act(order, kind === 'reject' ? 'REJECTED' : 'CANCELLED', { reason: value });
      }} />
    </div>
  );
}

function ActionDialog({ target, onClose, onSubmit }: { target: { order: Order; kind: 'reject' | 'cancel' | 'complete' } | null; onClose: () => void; onSubmit: (value: string) => Promise<unknown> }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(''); setError(null); }, [target]);
  if (!target) return null;
  const { order, kind } = target;
  const complete = kind === 'complete';
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} title={complete ? `Hand over order #${order.number}` : `${kind === 'reject' ? 'Decline' : 'Cancel'} order #${order.number}?`}
      description={complete ? `Ask ${order.customer.firstName} for the 4-digit code on their order.${order.paymentOption === 'ON_PICKUP' ? ` Collect ${formatCedis(order.total)}.` : ''}` : `${order.customer.firstName} is told the reason.${order.paymentOption === 'ONLINE' && order.paid ? ' Their payment is refunded.' : ''}`}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {complete ? (
          <Field label="Customer's code" htmlFor="hand-code"><Input id="hand-code" autoFocus inputMode="numeric" maxLength={4} className="font-mono text-2xl tracking-[0.3em]" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /></Field>
        ) : (
          <Field label="Reason" htmlFor="act-reason"><Textarea id="act-reason" value={value} maxLength={300} placeholder="For example: we have run out of chicken" onChange={(e) => setValue(e.target.value)} /></Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Back</Button>
          <Button variant={complete ? 'primary' : 'danger'} loading={busy} disabled={complete ? value.length !== 4 : value.length < 3} onClick={submit}>
            {complete ? 'Complete order' : kind === 'reject' ? 'Decline order' : 'Cancel order'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Where a campus dispatcher delivery stands, for the vendor. */
function DispatchLine({ order }: { order: Order }) {
  const d = order.delivery;
  if (!d || (order.status !== 'READY' && order.status !== 'OUT_FOR_DELIVERY')) {
    return <p className="mt-1 text-xs text-muted">Delivered by a campus dispatcher.</p>;
  }
  const who = d.dispatcher ? `${d.dispatcher.student.firstName} ${d.dispatcher.student.lastName}${d.dispatcher.student.phone ? `, ${d.dispatcher.student.phone}` : ''}` : '';
  const text: Record<string, string> = {
    WAITING: 'Waiting for a dispatcher to take it.',
    ASSIGNED: `${who} is coming to collect it.`,
    PICKED_UP: `With ${who}.`,
    CANCELLED: 'Your own staff are delivering it.',
  };
  return (
    <div className="mt-1 flex flex-col gap-1">
      <p className="rounded bg-primary-soft px-2 py-1 text-xs">{text[d.status] ?? ''}</p>
      {d.problemNote && d.status !== 'CANCELLED' && <p className="rounded bg-warning-soft px-2 py-1 text-xs">Dispatcher reports: {d.problemNote}. Call them, or cancel the order if it cannot be delivered.</p>}
    </div>
  );
}
