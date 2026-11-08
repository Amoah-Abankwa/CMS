import { formatCedis } from '@anu/shared';
import type { DuesSettlement } from '@/api/fees';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PayNow } from '@/features/finance/PayNow';
import { useQuery } from '@/hooks/useQuery';

export default function DuesPayouts() {
  const q = useQuery<DuesSettlement[]>('fin.dues', '/fees/dues-settlements');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Dues payouts" subtitle="Departmental dues students paid online, passed on to each association." />
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No associations" why="Associations appear once the Dean of Students office sets them up." /> : <>{list.map((a) => (
          <Card key={a.id}>
            <Text variant="heading">{a.code}: {a.name}</Text>
            <Text variant="small" tone="muted">Online {formatCedis(a.online)}, cash {formatCedis(a.cash)} (kept by the officers). Paid out {formatCedis(a.paidOut)}.</Text>
            <Text variant="label">{formatCedis(a.owed)} owed{a.payoutNumber ? `, to ${a.payoutNetwork} ${a.payoutNumber}` : ', no payout number yet'}</Text>
            {a.owed > 0 && a.payoutNumber ? <PayNow purpose="ASSOCIATION" subjectId={a.id} amount={a.owed} label={a.code} onDone={q.refresh} /> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
