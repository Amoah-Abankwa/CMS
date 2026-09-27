'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDate } from '@/lib/format';
import { feesApi, type MyDues as Data } from '../api';
import { usePaymentReturn } from './use-payment-return';

export function MyDues() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { feesApi.myDues().then(setData).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(() => { load(); }, [load]);
  const notice = usePaymentReturn(load);

  const pay = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const r = await feesApi.payDues(id);
      window.location.href = r.paymentUrl;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  if (!data.associations.length) return <EmptyState title="No departmental association" description="Your department does not have an association on the platform yet." />;
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm text-muted">
        You belong to {data.associations.map((a) => `${a.code} (${a.name})`).join(' and ')}. Pay online, or in cash to an association officer; either way you get a receipt by SMS. Never pay cash without getting that SMS.
      </p>
      {data.levies.length === 0 ? <EmptyState title="No dues set yet" /> : (
        <Card>
          <CardHeader title="Dues" />
          <ul className="divide-y divide-border">
            {data.levies.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{l.association.code}: {l.title}</span> <span className="tabular-nums">{formatCedis(l.amount)}</span>
                  <span className="block text-xs text-muted">{l.semester}. {l.payment ? `Paid ${formatDate(l.payment.createdAt)} (${l.payment.method === 'CASH' ? 'cash' : 'online'}), receipt ${l.payment.receiptNumber}.` : `Due ${formatDate(l.dueOn)}.`}</span>
                </span>
                <span className="shrink-0">
                  {l.payment ? <Badge tone="success">Paid</Badge> : l.isOpen ? <Button size="sm" loading={busy === l.id} onClick={() => pay(l.id)}>Pay {formatCedis(l.amount)}</Button> : <Badge>Closed</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data.cancelled.length > 0 && (
        <Alert tone="warning" title="Cancelled receipts">
          {data.cancelled.map((c) => `${c.receiptNumber} (${formatCedis(c.amount)}): ${c.voidReason}`).join('. ')}
        </Alert>
      )}
    </div>
  );
}
