import { router } from 'expo-router';
import { formatMoney } from '@anu/shared';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { balanceOf, type MyFees } from '@/features/fees/types';
import { useQuery } from '@/hooks/useQuery';

export function FeesGlance() {
  const q = useQuery<MyFees>('me.fees', '/me/fees');
  return (
    <QueryView q={q} skeleton={<SkeletonCard lines={2} />}>
      {(d) => {
        const bill = d.bills[0];
        if (!bill) return null;
        const owed = balanceOf(bill);
        return (
          <Card>
            <Text variant="small" tone="muted">Fees, {bill.semesterLabel}</Text>
            <Text variant="title" tone={owed ? 'default' : 'success'}>{owed ? formatMoney(owed, bill.currency) : 'Paid in full'}</Text>
            {owed ? <Button label="See fees" variant="secondary" onPress={() => router.push('/(tabs)/fees')} /> : null}
          </Card>
        );
      }}
    </QueryView>
  );
}
