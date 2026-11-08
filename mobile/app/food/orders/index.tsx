import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { formatCedis, ORDER_STATUS_LABEL } from '@anu/shared';
import type { Order } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

export default function Orders() {
  const q = useQuery<{ items: Order[] }>('food.orders', '/food/orders', { page: 1, pageSize: 20 });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="My orders" />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No orders yet" why="Orders you place with campus vendors show here with their progress." action={{ label: 'See vendors', onPress: () => router.replace('/food' as never) }} /> : <>{d.items.map((o) => (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/food/orders/${o.id}` as never)}>
            <Card>
              <Text variant="label">Order {o.number}, {o.vendor.name}</Text>
              <Text variant="small" tone="muted">{ORDER_STATUS_LABEL[o.status]}. {formatCedis(o.total)}</Text>
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
