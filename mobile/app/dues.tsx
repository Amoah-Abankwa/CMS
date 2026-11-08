import { useState } from 'react';
import { formatCedis } from '@anu/shared';
import { feesApi, type MyDues } from '@/api/fees';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { PaymentStarted } from '@/components/states/PaymentStarted';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { openPdf } from '@/lib/files';
import { openPayment } from '@/lib/pay';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function Dues() {
  const q = useQuery<MyDues>('me.dues', '/me/dues');
  const { busy, error, run } = useSubmit();
  const [paying, setPaying] = useState(false);
  if (paying) return <Screen><PaymentStarted what="your dues" onRefresh={() => { setPaying(false); q.refresh(); }} /></Screen>;
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Departmental dues" subtitle={q.data?.associations.map((a) => a.code).join(', ')} />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(d) => d.levies.length === 0 ? <EmptyState title="No dues to pay" why="Your association's patron has not set dues for this term yet." /> : <>{d.levies.map((l) => (
          <Card key={l.id}>
            <Text variant="heading">{l.title}</Text>
            <Text variant="small" tone="muted">{l.association.name}. {formatCedis(l.amount)}, due {day(l.dueOn)}</Text>
            {l.payment ? (
              <>
                <Badge label={`Paid ${l.payment.method === 'CASH' ? 'in cash' : 'online'}, receipt ${l.payment.receiptNumber}`} tone="success" />
                <Button label="Receipt (PDF)" variant="secondary" onPress={() => void run(() => openPdf(`/me/dues/receipts/${l.payment!.id}/pdf`, `dues-receipt-${l.payment!.receiptNumber}.pdf`))} />
              </>
            ) : l.isOpen ? (
              <Button label={`Pay ${formatCedis(l.amount)} online`} loading={busy} onPress={() => void run(async () => { await openPayment((await feesApi.payDues(l.id)).paymentUrl); setPaying(true); })} />
            ) : <Text variant="small" tone="muted">Collection is closed. Ask your association's officers.</Text>}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
