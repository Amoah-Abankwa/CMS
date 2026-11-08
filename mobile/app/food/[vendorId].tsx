import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatCedis } from '@anu/shared';
import type { MyMealPlan, VendorMenu } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Checkout } from '@/features/food/Checkout';
import { QuantityStepper } from '@/features/food/QuantityStepper';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function VendorMenuScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const q = useQuery<VendorMenu>(`food.menu.${vendorId}`, `/food/vendors/${vendorId}`);
  const plans = useQuery<MyMealPlan[]>('food.myPlans', '/food/meal-plans');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data?.name ?? 'Menu'} subtitle={q.data?.location} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(m) => <Menu m={m} plans={(plans.data ?? []).filter((p) => p.status === 'ACTIVE' && p.plan.vendor.id === m.id)} />}
      </QueryView>
    </Screen>
  );
}

function Menu({ m, plans }: { m: VendorMenu; plans: MyMealPlan[] }) {
  const { space } = useTheme();
  // The basket is a draft: leaving the screen or the session ending keeps it.
  const basket = useDraft<Record<string, number>>(`food.basket.${m.id}`, {});
  const items = m.items.filter((i) => i.isAvailable);
  const lines = Object.entries(basket.value).filter(([, n]) => (n as number) > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity: quantity as number }));
  const subtotal = lines.reduce((t, l) => t + (m.items.find((i) => i.id === l.menuItemId)?.price ?? 0) * l.quantity, 0);
  if (!items.length) return <EmptyState title="Nothing on the menu right now" why={`${m.name} has no dishes available at the moment. Try again later or another vendor.`} />;
  const sections = [...m.categories, { id: '', name: 'Other' }].map((c) => ({ ...c, items: items.filter((i) => (i.categoryId ?? '') === c.id) })).filter((c) => c.items.length);
  return (
    <View style={{ gap: space.lg }}>
      {m.paused || !m.openNow ? <Notice tone="warning" title={m.paused ? 'Not taking orders right now' : 'Closed now'}>You can still look at the menu. Orders open again during opening hours.</Notice> : null}
      {sections.map((c) => (
        <View key={c.id || 'other'} style={{ gap: space.sm }}>
          <Text variant="heading">{c.name}</Text>
          {c.items.map((i) => (
            <Card key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{i.name}</Text>
                {i.description ? <Text variant="small" tone="muted">{i.description}</Text> : null}
                <Text variant="small">{formatCedis(i.price)}</Text>
              </View>
              <QuantityStepper label={i.name} value={(basket.value[i.id] as number) ?? 0} onChange={(n) => basket.set(i.id, n)} />
            </Card>
          ))}
        </View>
      ))}
      {lines.length && m.openNow && !m.paused ? <Checkout menu={m} lines={lines} subtotal={subtotal} plans={plans} onPlaced={basket.clear} /> : null}
    </View>
  );
}
