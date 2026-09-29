'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ACTIVE_ORDER_STATUSES,
  formatCedis,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import {
  clockTime,
  foodApi,
  STATUS_TONE,
  type Order,
} from '../api';

const STEPS: Record<'PICKUP' | 'DELIVERY', OrderStatus[]> = {
  PICKUP: ['PLACED', 'ACCEPTED', 'READY', 'COMPLETED'],
  DELIVERY: ['PLACED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'COMPLETED'],
};

const DISPATCH_STEPS: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
];

/** Labels differ when a campus dispatcher is bringing the order. */
const label = (o: Order, s: OrderStatus) =>
  o.viaDispatcher && s === 'READY'
    ? 'Finding a dispatcher'
    : ORDER_STATUS_LABEL[s];

type LiveLocationValue = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
};

function isLiveLocation(value: unknown): value is LiveLocationValue {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const location = value as Record<string, unknown>;

  return (
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    typeof location.at === 'string' &&
    (location.accuracy === null ||
      typeof location.accuracy === 'number')
  );
}

/** Follows an order until it is finished. On return from checkout, confirms the payment with the server first. */
export function OrderTracking({ orderId }: { orderId: string }) {
  const params = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = useRef(false);

  const load = useCallback(
    () =>
      foodApi
        .order(orderId)
        .then(setOrder)
        .catch((err) => setError(errorMessage(err))),
    [orderId],
  );

  useEffect(() => {
    const reference = params.get('reference');

    const run = async () => {
      if (reference && !verified.current) {
        verified.current = true;

        try {
          const p = await foodApi.verifyPayment(reference);

          if (p.status === 'FAILED') {
            setError(
              'The payment did not go through. You can try again below.',
            );
          }

          if (p.status === 'PENDING') {
            setNotice(
              'We are waiting for your payment to be confirmed. This page will update.',
            );
          }
        } catch (err) {
          setError(errorMessage(err));
        }
      }

      await load();
    };

    void run();
  }, [params, load]);

  useEffect(() => {
    if (
      !order ||
      !(
        ACTIVE_ORDER_STATUSES.includes(order.status) ||
        order.status === 'PENDING_PAYMENT'
      )
    ) {
      return;
    }

    const id = window.setInterval(async () => {
      // A payment still pending is re-checked with the provider on each refresh.
      const ref = order.payments[0];

      if (
        order.status === 'PENDING_PAYMENT' &&
        ref?.status === 'PENDING'
      ) {
        await foodApi
          .verifyPayment(ref.reference)
          .catch(() => undefined);
      }

      void load();
    }, 10_000);

    return () => window.clearInterval(id);
  }, [order, load]);

  if (!order) {
    return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  }

  const steps = order.viaDispatcher
    ? DISPATCH_STEPS
    : STEPS[order.fulfilment];

  const rider = order.delivery?.dispatcher?.student;
  const dispatcher = order.delivery?.dispatcher;

  /*
   * The current Order API type does not declare dispatcher.location.
   * Check for the property at runtime before using it so the component
   * remains compatible with responses that include live location data.
   */
  const rawLocation =
    dispatcher &&
    'location' in dispatcher
      ? (dispatcher as unknown as { location?: unknown }).location
      : undefined;

  const liveLocation = isLiveLocation(rawLocation)
    ? rawLocation
    : null;

  const at = steps.indexOf(order.status);
  const ended =
    order.status === 'CANCELLED' ||
    order.status === 'REJECTED';

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
      {notice && order.status === 'PENDING_PAYMENT' && (
        <Alert tone="info">{notice}</Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader
          title={`Order #${order.number}`}
          description={`${order.vendor.name}, ${order.vendor.location}`}
          actions={
            <Badge tone={STATUS_TONE[order.status]}>
              {label(order, order.status)}
            </Badge>
          }
        />

        <CardBody className="flex flex-col gap-4">
          {!ended && order.status !== 'PENDING_PAYMENT' && (
            <ol
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
              }}
              aria-label="Progress"
            >
              {steps.map((s, i) => (
                <li
                  key={s}
                  className="flex flex-col gap-1"
                >
                  <span
                    className={cn(
                      'h-1.5 rounded-sm',
                      i <= at
                        ? 'bg-primary'
                        : 'bg-surface-muted',
                    )}
                    aria-hidden
                  />

                  <span
                    className={cn(
                      'text-xs',
                      i === at
                        ? 'font-medium'
                        : 'text-muted',
                    )}
                  >
                    {label(order, s)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {order.status === 'OUT_FOR_DELIVERY' &&
            liveLocation && (
              <LiveLocation
                loc={liveLocation}
                name={rider?.firstName ?? 'Dispatcher'}
              />
            )}

          {order.status === 'ACCEPTED' &&
            order.estimatedReadyAt && (
              <p className="text-sm">
                Expected{' '}
                {order.fulfilment === 'PICKUP'
                  ? 'ready'
                  : 'to leave'}{' '}
                around {clockTime(order.estimatedReadyAt)}.
              </p>
            )}

          {order.viaDispatcher &&
            rider &&
            (order.status === 'READY' ||
              order.status === 'OUT_FOR_DELIVERY') && (
              <p className="text-sm">
                {order.status === 'READY'
                  ? `${rider.firstName}, a campus dispatcher, is collecting it.`
                  : `${rider.firstName} is bringing it to you.`}

                {rider.phone && (
                  <>
                    {' '}
                    Phone:{' '}
                    <a
                      className="text-primary hover:underline"
                      href={`tel:${rider.phone}`}
                    >
                      {rider.phone}
                    </a>
                    .
                  </>
                )}
              </p>
            )}

          {!ended &&
            order.status !== 'COMPLETED' &&
            order.status !== 'PENDING_PAYMENT' &&
            order.pickupCode && (
              <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-center">
                <p className="text-xs text-muted">
                  {order.fulfilment === 'PICKUP'
                    ? 'Show this code when you collect'
                    : 'Give this code to the person delivering'}
                </p>

                <p className="font-mono text-4xl font-bold tracking-[0.3em]">
                  {order.pickupCode}
                </p>
              </div>
            )}

          {ended && (
            <Alert tone="danger">
              {order.cancelReason ??
                'This order was cancelled.'}

              {payment?.status === 'REFUND_PENDING'
                ? ' Your refund is on its way.'
                : payment?.status === 'REFUNDED'
                  ? ' You have been refunded.'
                  : ''}
            </Alert>
          )}

          {order.status === 'PENDING_PAYMENT' && (
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy}
                onClick={() =>
                  act(async () => {
                    const r = await foodApi.pay(order.id);
                    window.location.href = r.paymentUrl;
                  })
                }
              >
                Pay {formatCedis(order.total)}
              </Button>

              <Button
                variant="ghost"
                onClick={() =>
                  act(async () =>
                    setOrder(
                      await foodApi.cancel(order.id),
                    ),
                  )
                }
              >
                Cancel order
              </Button>
            </div>
          )}

          {order.status === 'PLACED' && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                loading={busy}
                onClick={() =>
                  act(async () =>
                    setOrder(
                      await foodApi.cancel(order.id),
                    ),
                  )
                }
              >
                Cancel order
              </Button>
            </div>
          )}

          <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
            {order.items.map((item, index) => (
              <li
                key={index}
                className="flex justify-between"
              >
                <span>
                  {item.quantity} x {item.name}
                </span>

                <span className="tabular-nums">
                  {formatCedis(item.lineTotal)}
                </span>
              </li>
            ))}

            {order.deliveryFee > 0 && (
              <li className="flex justify-between text-muted">
                <span>Delivery</span>

                <span className="tabular-nums">
                  {formatCedis(order.deliveryFee)}
                </span>
              </li>
            )}

            <li className="flex justify-between font-semibold">
              <span>Total</span>

              <span className="tabular-nums">
                {formatCedis(order.total)}
              </span>
            </li>
          </ul>

          <p className="text-xs text-muted">
            {order.fulfilment === 'DELIVERY'
              ? `Deliver to ${order.deliveryAddress}. `
              : 'Pickup. '}

            {order.paymentOption === 'ONLINE'
              ? order.paid
                ? 'Paid online.'
                : 'To be paid online.'
              : order.paid
                ? 'Paid at the counter.'
                : 'Pay when you collect.'}{' '}

            Vendor phone: {order.vendor.phone}.

            {order.scheduledFor
              ? ` Scheduled for ${new Date(
                  order.scheduledFor,
                ).toLocaleString('en-GB', {
                  timeZone: 'Africa/Accra',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}.`
              : ''}

            {order.mealCredit > 0
              ? ` A meal plan meal covered ${formatCedis(
                  order.mealCredit,
                )}.`
              : ''}
          </p>
        </CardBody>
      </Card>

      {order.status === 'COMPLETED' && (
        <RateOrder
          order={order}
          onRated={() => void load()}
        />
      )}
    </div>
  );
}

function LiveLocation({
  loc,
  name,
}: {
  loc: LiveLocationValue;
  name: string;
}) {
  const secs = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(loc.at).getTime()) / 1000,
    ),
  );

  return (
    <p className="rounded-md bg-surface-muted px-3 py-2 text-sm">
      {name}&apos;s location was updated{' '}
      {secs < 60
        ? `${secs} seconds`
        : `${Math.round(secs / 60)} minutes`}{' '}
      ago
      {loc.accuracy
        ? `, to within ${Math.round(loc.accuracy)} m`
        : ''}
      .{' '}
      <a
        className="text-primary hover:underline"
        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        See on a map
      </a>
    </p>
  );
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(n)}
          className={cn(
            'size-9 rounded-md border text-sm font-medium',
            n <= value
              ? 'border-primary bg-primary text-white'
              : 'border-border',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function RateOrder({
  order,
  onRated,
}: {
  order: Order;
  onRated: () => void;
}) {
  const [v, setV] = useState(0);
  const [d, setD] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (order.rating) {
    return (
      <p className="text-sm text-muted">
        You rated {order.vendor.name}{' '}
        {order.rating.vendorStars} out of 5
        {order.rating.dispatcherStars
          ? ` and the dispatcher ${order.rating.dispatcherStars} out of 5`
          : ''}
        . Thank you.
      </p>
    );
  }

  const dispatched =
    order.delivery?.status === 'DELIVERED' &&
    !!order.delivery.dispatcher;

  return (
    <Card>
      <CardHeader title="How was it?" />

      <CardBody className="flex flex-col gap-3">
        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm">
            {order.vendor.name}
          </span>

          <Stars
            value={v}
            onChange={setV}
            label={`Rate ${order.vendor.name}`}
          />
        </div>

        {dispatched && (
          <div className="flex flex-col gap-1">
            <span className="text-sm">
              The dispatcher,{' '}
              {order.delivery!.dispatcher!.student.firstName}
            </span>

            <Stars
              value={d}
              onChange={setD}
              label="Rate the dispatcher"
            />
          </div>
        )}

        <Textarea
          aria-label="Comment (optional)"
          placeholder="Comment (optional)"
          value={comment}
          maxLength={500}
          onChange={(e) => setComment(e.target.value)}
        />

        <div>
          <Button
            disabled={!v || (dispatched && !d)}
            onClick={() =>
              foodApi
                .rate(order.id, {
                  vendorStars: v,
                  vendorComment:
                    comment.trim() || undefined,
                  dispatcherStars: dispatched
                    ? d
                    : undefined,
                })
                .then(onRated)
                .catch((err) =>
                  setError(errorMessage(err)),
                )
            }
          >
            Send rating
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}