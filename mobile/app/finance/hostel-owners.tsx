import { formatCedis } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PayNow } from '@/features/finance/PayNow';
import { useQuery } from '@/hooks/useQuery';

interface Row { id: string; name: string; online: number; paidOut: number; owed: number; owner: { firstName: string; lastName: string; phone: string | null } | null }

export default function HostelOwnerPayouts() {
  const q = useQuery<Row[]>('fin.owners', '/fees/hostel-owners');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Hostel owner payouts" subtitle="Hostel fees students paid online, passed on to each private hostel." />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nothing to pay" why="No private hostel fees have been paid online yet." /> : <>{list.map((h) => (
          <Card key={h.id}>
            <Text variant="heading">{h.name}</Text>
            <Text variant="small" tone="muted">{h.owner ? `${h.owner.firstName} ${h.owner.lastName}, ${h.owner.phone ?? ''}. ` : ''}Online {formatCedis(h.online)}, paid out {formatCedis(h.paidOut)}.</Text>
            <Text variant="label">{formatCedis(h.owed)} owed</Text>
            {h.owed > 0 ? <PayNow purpose="HOSTEL_OWNER" subjectId={h.id} amount={h.owed} label={h.name} onDone={q.refresh} /> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
