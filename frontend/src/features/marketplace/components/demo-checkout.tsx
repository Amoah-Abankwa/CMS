'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { foodApi } from '../api';

/** Stands in for Paystack's checkout when the platform runs with the demo payment provider. */
export function DemoCheckout() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const next = params.get('next') ?? '/food/orders';
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (reference) foodApi.verifyPayment(reference).then((p) => setAmount(p.amount)).catch((err) => setError(errorMessage(err)));
  }, [reference]);

  const finish = async (outcome: 'success' | 'failed') => {
    setBusy(outcome);
    try {
      await foodApi.demoPay(reference, outcome);
      // Only return to pages in this app.
      const url = new URL(next, window.location.origin);
      window.location.href = url.origin === window.location.origin ? url.toString() : '/food/orders';
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader title="Test payment" description="This is the demo checkout. No money moves. With Paystack switched on, customers pay by mobile money or card here." />
        <CardBody className="flex flex-col gap-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {amount === null && !error ? <Spinner /> : amount !== null && (
            <>
              <p className="text-center text-3xl font-semibold tabular-nums">{formatCedis(amount)}</p>
              <p className="text-center font-mono text-xs text-muted">{reference}</p>
              <div className="flex flex-col gap-2">
                <Button loading={busy === 'success'} disabled={!!busy} onClick={() => finish('success')}>Pay (test)</Button>
                <Button variant="secondary" loading={busy === 'failed'} disabled={!!busy} onClick={() => finish('failed')}>Payment fails (test)</Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
