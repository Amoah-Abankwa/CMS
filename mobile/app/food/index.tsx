import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { VendorPublic } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function Food() {
  const { space } = useTheme();
  const q = useQuery<Array<VendorPublic & { itemsAvailable: number }>>('food.vendors', '/food/vendors');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Food" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label="My orders" variant="secondary" onPress={() => router.push('/food/orders' as never)} /></View>
        <View style={{ flex: 1 }}><Button label="Meal plans" variant="secondary" onPress={() => router.push('/food/plans' as never)} /></View>
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(vendors) => vendors.length === 0 ? <EmptyState title="No vendors yet" why="Campus food vendors appear here once the Dean of Students office approves them." /> : <>{vendors.map((v) => (
          <Pressable key={v.id} accessibilityRole="button" onPress={() => router.push(`/food/${v.id}` as never)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text variant="heading" style={{ flex: 1 }}>{v.name}</Text>
                {v.paused ? <Badge label="Paused" tone="warning" /> : v.openNow ? <Badge label="Open" tone="success" /> : <Badge label="Closed" />}
              </View>
              <Text variant="small" tone="muted">{v.location}{v.rating ? `. ${v.rating.toFixed(1)} stars (${v.ratings})` : ''}</Text>
              <Text variant="small">{[v.offersPickup && 'Pick up', v.offersDelivery && 'Delivery'].filter(Boolean).join(', ')}. About {v.prepMinutes} minutes.</Text>
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
