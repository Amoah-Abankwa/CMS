'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate, formatDateTime } from '@/lib/format';
import { dispatchApi, type Earnings as E } from '@/features/employment/api';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function Earnings() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 13 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState<E | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setData(null);
    dispatchApi.earnings(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`).then(setData).catch((err) => setError(errorMessage(err)));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted">Waiting to be paid to you</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCedis(Math.max(0, data.balance))}</p>
            <p className="text-xs text-muted">Finance pays to {data.payout.network} {data.payout.number} ({data.payout.name}).</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted">Earned in the dates below</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCedis(data.earned)}</p>
            <p className="text-xs text-muted">{data.deliveries.length} deliveries.</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader title="Deliveries" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="er-from"><Input id="er-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="er-to"><Input id="er-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        </CardBody>
        {!data ? <CardBody><Spinner /></CardBody> : data.deliveries.length === 0 ? <CardBody><EmptyState title="No deliveries in these dates" /></CardBody> : (
          <ul className="divide-y divide-border border-t border-border">
            {data.deliveries.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>#{d.order.number} {d.order.vendor.name} to {d.order.deliveryAddress}<span className="block text-xs text-muted">{formatDateTime(d.deliveredAt)}</span></span>
                <span className="tabular-nums">{formatCedis(d.fee)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data && data.payouts.length > 0 && (
        <Card>
          <CardHeader title="Payments to you" />
          <ul className="divide-y divide-border">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>{formatDate(p.createdAt)}<span className="block text-xs text-muted">For {formatDate(p.periodFrom)} to {formatDate(p.periodTo)}{p.reference ? `. Transaction ${p.reference}` : ''}</span></span>
                <span className="tabular-nums">{formatCedis(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
