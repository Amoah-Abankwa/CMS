'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ACTIVE_ORDER_STATUSES, formatCedis, ORDER_STATUS_LABEL, type OrderStatus } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { clockTime, foodApi, STATUS_TONE, type Order } from '../api';

const STEPS: Record<'PICKUP' | 'DELIVERY', OrderStatus[]> = {
  PICKUP: ['PLACED', 'ACCEPTED', 'READY', 'COMPLETED'],
  DELIVERY: ['PLACED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'COMPLETED'],
};
const DISPATCH_STEPS: OrderStatus[] = ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
/** Labels differ when a campus dispatcher is bringing the order. */
const label = (o: Order, s: OrderStatus) => (o.viaDispatcher && s === 'READY' ? 'Finding a dispatcher' : ORDER_STATUS_LABEL[s]);

/** Follows an order until it is finished. On return from checkout, confirms the payment with the server first. */
export function OrderTracking({ orderId }: { orderId: string }) {
  const params = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = useRef(false);

  const load = useCallback(() => foodApi.order(orderId).then(setOrder).catch((err) => setError(errorMessage(err))), [orderId]);

  useEffect(() => {
    const reference = params.get('reference');
    const run = async () => {
      if (reference && !verified.current) {
        verified.current = true;
        try {
          const p = await foodApi.verifyPayment(reference);
          if (p.status === 'FAILED') setError('The payment did not go through. You can try again below.');
          if (p.status === 'PENDING') setNotice('We are waiting for your payment to be confirmed. This page will update.');
        } catch (err) {
          setError(errorMessage(err));
        }
      }
      await load();
    };
    void run();
  }, [params, load]);

  useEffect(() => {
    if (!order || !(ACTIVE_ORDER_STATUSES.includes(order.status) || order.status === 'PENDING_PAYMENT')) return;
    const id = window.setInterval(async () => {
      // A payment still pending is re-checked with the provider on each refresh.
      const ref = order.payments[0];
      if (order.status === 'PENDING_PAYMENT' && ref?.status === 'PENDING') await foodApi.verifyPayment(ref.reference).catch(() => undefined);
      void load();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [order, load]);

  if (!order) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const steps = order.viaDispatcher ? DISPATCH_STEPS : STEPS[order.fulfilment];
  const rider = order.delivery?.dispatcher?.student;
  const at = steps.indexOf(order.status);
  const ended = order.status === 'CANCELLED' || order.status === 'REJECTED';
  const payment = order.payments[0];

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {notice && order.status === 'PENDING_PAYMENT' && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Card>
        <CardHeader title={`Order #${order.number}`} description={`${order.vendor.name}, ${order.vendor.location}`} actions={<Badge tone={STATUS_TONE[order.status]}>{label(order, order.status)}</Badge>} />
        <CardBody className="flex flex-col gap-4">
          {!ended && order.status !== 'PENDING_PAYMENT' && (
            <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
              {steps.map((s, i) => (
                <li key={s} className="flex flex-col gap-1">
                  <span className={cn('h-1.5 rounded-sm', i <= at ? 'bg-primary' : 'bg-surface-muted')} aria-hidden />
                  <span className={cn('text-xs', i === at ? 'font-medium' : 'text-muted')}>{label(order, s)}</span>
                </li>
              ))}
            </ol>
          )}
          {order.status === 'ACCEPTED' && order.estimatedReadyAt && <p className="text-sm">Expected {order.fulfilment === 'PICKUP' ? 'ready' : 'to leave'} around {clockTime(order.estimatedReadyAt)}.</p>}
          {order.viaDispatcher && rider && (order.status === 'READY' || order.status === 'OUT_FOR_DELIVERY') && (
            <p className="text-sm">
              {order.status === 'READY' ? `${rider.firstName}, a campus dispatcher, is collecting it.` : `${rider.firstName} is bringing it to you.`}
              {rider.phone && <> Phone: <a className="text-primary hover:underline" href={`tel:${rider.phone}`}>{rider.phone}</a>.</>}
            </p>
          )}
          {!ended && order.status !== 'COMPLETED' && order.status !== 'PENDING_PAYMENT' && order.pickupCode && (
            <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-center">
              <p className="text-xs text-muted">{order.fulfilment === 'PICKUP' ? 'Show this code when you collect' : 'Give this code to the person delivering'}</p>
              <p className="font-mono text-4xl font-bold tracking-[0.3em]">{order.pickupCode}</p>
            </div>
          )}
          {ended && <Alert tone="danger">{order.cancelReason ?? 'This order was cancelled.'}{payment?.status === 'REFUND_PENDING' ? ' Your refund is on its way.' : payment?.status === 'REFUNDED' ? ' You have been refunded.' : ''}</Alert>}
          {order.status === 'PENDING_PAYMENT' && (
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={() => act(async () => { const r = await foodApi.pay(order.id); window.location.href = r.paymentUrl; })}>Pay {formatCedis(order.total)}</Button>
              <Button variant="ghost" onClick={() => act(async () => setOrder(await foodApi.cancel(order.id)))}>Cancel order</Button>
            </div>
          )}
          {order.status === 'PLACED' && <div><Button variant="ghost" size="sm" loading={busy} onClick={() => act(async () => setOrder(await foodApi.cancel(order.id)))}>Cancel order</Button></div>}

          <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
            {order.items.map((i, n) => <li key={n} className="flex justify-between"><span>{i.quantity} x {i.name}</span><span className="tabular-nums">{formatCedis(i.lineTotal)}</span></li>)}
            {order.deliveryFee > 0 && <li className="flex justify-between text-muted"><span>Delivery</span><span className="tabular-nums">{formatCedis(order.deliveryFee)}</span></li>}
            <li className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{formatCedis(order.total)}</span></li>
          </ul>
          <p className="text-xs text-muted">
            {order.fulfilment === 'DELIVERY' ? `Deliver to ${order.deliveryAddress}. ` : 'Pickup. '}
            {order.paymentOption === 'ONLINE' ? (order.paid ? 'Paid online.' : 'To be paid online.') : order.paid ? 'Paid at the counter.' : 'Pay when you collect.'}
            {' '}Vendor phone: {order.vendor.phone}.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
