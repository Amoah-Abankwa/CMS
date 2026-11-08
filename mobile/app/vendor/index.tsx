import { useEffect } from 'react';
import { Switch, View } from 'react-native';
import { formatCedis, ORDER_STATUS_LABEL } from '@anu/shared';
import { foodApi, type Board } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { OrderActions } from '@/features/vendor/OrderActions';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

const at = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

export default function VendorOrders() {
  const { space, colors } = useTheme();
  const q = useQuery<Board>('vendor.board', '/vendor/orders');
  useEffect(() => { const t = setInterval(q.refresh, 15000); return () => clearInterval(t); }, [q.refresh]);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Orders" subtitle={q.data ? `${q.data.vendor.name}. Sales today ${formatCedis(q.data.salesToday)}` : undefined} />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(b) => (
          <View style={{ gap: space.md }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{b.vendor.paused ? 'Not taking orders' : 'Taking orders'}</Text>
                <Text variant="small" tone="muted">{b.vendor.openNow ? 'Within opening hours.' : 'Outside opening hours.'}</Text>
              </View>
              <Switch value={!b.vendor.paused} onValueChange={(on) => void foodApi.pause(!on).then(q.refresh)} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Taking orders" />
            </Card>
            {b.active.length === 0 ? <EmptyState title="No orders right now" why={b.vendor.paused ? 'You are paused, so students cannot order. Turn orders back on above.' : 'New orders appear here straight away. This page refreshes every 15 seconds.'} /> : b.active.map((o) => (
              <Card key={o.id}>
                <Text variant="heading">Order {o.number}, {ORDER_STATUS_LABEL[o.status]}</Text>
                <Text variant="small" tone="muted">{at(o.placedAt)}. {o.fulfilment === 'PICKUP' ? 'Pick up' : `Deliver to ${o.deliveryAddress}`}{o.scheduledFor ? `, for ${at(o.scheduledFor)}` : ''}</Text>
                {o.items.map((i) => <Text key={i.name}>{i.quantity} x {i.name}</Text>)}
                {o.note ? <Text variant="small">Note: {o.note}</Text> : null}
                <Text variant="label">{formatCedis(o.total)}{o.paid ? ', paid' : o.paymentOption === 'ON_PICKUP' ? ', to pay on collection' : ', waiting for payment'}</Text>
                <OrderActions o={o} onDone={q.refresh} />
              </Card>
            ))}
            {b.done.length ? <Text variant="small" tone="muted">{b.done.length} finished today.</Text> : null}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
