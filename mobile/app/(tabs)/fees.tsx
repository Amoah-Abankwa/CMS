import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { BillCard } from '@/features/fees/BillCard';
import type { MyFees } from '@/features/fees/types';
import { useQuery } from '@/hooks/useQuery';

export default function Fees() {
  const q = useQuery<MyFees>('me.fees', '/me/fees');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Text variant="title">Fees</Text>
      <QueryView q={q} skeleton={<><SkeletonCard lines={3} /><SkeletonCard lines={2} /></>}>
        {(d) =>
          d.bills.length === 0 ? (
            <EmptyState title="No bills yet" why="The Finance Office has not issued this term's bills. You will get a notification when yours is ready." action={{ label: 'Check again', onPress: q.refresh }} />
          ) : (
            d.bills.map((b) => <BillCard key={b.id} bill={b} onPaid={q.refresh} />)
          )
        }
      </QueryView>
    </Screen>
  );
}
