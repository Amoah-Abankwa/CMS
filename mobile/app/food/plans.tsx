import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { foodApi, type MealPlan, type MyMealPlan, type VendorPublic } from '@/api/marketplace';
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
import { openPayment } from '@/lib/pay';

export default function Plans() {
  const mine = useQuery<MyMealPlan[]>('food.myPlans', '/food/meal-plans');
  const vendors = useQuery<VendorPublic[]>('food.vendors', '/food/vendors');
  const [paying, setPaying] = useState(false);
  if (paying) return <Screen><PaymentStarted what="your meal plan" onRefresh={() => { setPaying(false); mine.refresh(); }} /></Screen>;
  return (
    <Screen refreshing={mine.loading} onRefresh={mine.refresh}>
      <Header title="Meal plans" subtitle="Pay once for several meals at one vendor." />
      <QueryView q={mine} skeleton={<SkeletonList rows={2} />}>
        {(list) => list.length === 0 ? <EmptyState title="No meal plans yet" why="Buy a plan below; each order then uses one meal instead of paying." /> : <>{list.map((p) => (
          <Card key={p.id}>
            <Text variant="label">{p.plan.name}, {p.plan.vendor.name}</Text>
            <Badge label={p.status === 'ACTIVE' ? `${p.mealsLeft} of ${p.mealsTotal} meals left` : p.status === 'USED_UP' ? 'Used up' : 'Expired'} tone={p.status === 'ACTIVE' ? 'success' : 'neutral'} />
          </Card>
        ))}</>}
      </QueryView>
      <QueryView q={vendors} skeleton={null}>{(vs) => <>{vs.map((v) => <VendorPlans key={v.id} v={v} onPaying={() => setPaying(true)} />)}</>}</QueryView>
    </Screen>
  );
}

function VendorPlans({ v, onPaying }: { v: VendorPublic; onPaying: () => void }) {
  const q = useQuery<MealPlan[]>(`food.plans.${v.id}`, `/food/vendors/${v.id}/meal-plans`);
  const { busy, error, run } = useSubmit();
  const plans = (q.data ?? []).filter((p) => p.isActive !== false);
  if (!plans.length) return null;
  return (
    <View>
      <Text variant="heading">{v.name}</Text>
      <FormError error={error} />
      {plans.map((p) => (
        <Card key={p.id}>
          <Text variant="label">{p.name}: {p.meals} meals for {formatCedis(p.price)}</Text>
          <Text variant="small" tone="muted">Use within {p.validDays} days.</Text>
          <Button label="Buy" loading={busy} onPress={() => void run(async () => { await openPayment((await foodApi.buyPlan(p.id)).paymentUrl); onPaying(); })} />
        </Card>
      ))}
    </View>
  );
}
