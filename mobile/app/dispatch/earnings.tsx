import { formatCedis } from '@anu/shared';
import type { Earnings } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function DispatchEarnings() {
  const q = useQuery<Earnings>('dispatch.earnings', '/dispatch/earnings', { from: monthStart(), to: today() });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="My earnings" subtitle="This month" />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(e) => (
          <>
            <Card>
              <Text variant="title">{formatCedis(e.balance)} to be paid</Text>
              <Text variant="small" tone="muted">Earned {formatCedis(e.earned)} this month. Paid to {e.payout.network} {e.payout.number}.</Text>
            </Card>
            {e.deliveries.length === 0 ? <EmptyState title="No deliveries this month" why="Deliveries you complete appear here with what you earned." /> : e.deliveries.map((d) => (
              <Card key={d.id} style={{ padding: 12 }}>
                <Text variant="label">Order {d.order.number}, {d.order.vendor.name}: {formatCedis(d.fee)}</Text>
                <Text variant="small" tone="muted">{new Date(d.deliveredAt).toLocaleString()} to {d.order.deliveryAddress}</Text>
              </Card>
            ))}
            {e.payouts.map((p) => <Text key={p.id} variant="small">Paid {formatCedis(p.amount)} on {new Date(p.createdAt).toLocaleDateString()}{p.reference ? `, ref ${p.reference}` : ''}</Text>)}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
