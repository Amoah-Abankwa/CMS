import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { dispatchApi, type DispatchState } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { PermissionPrompt } from '@/components/states/PermissionPrompt';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DeliveryCard } from '@/features/dispatch/DeliveryCard';
import { useLiveLocation } from '@/features/dispatch/useLiveLocation';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function Deliveries() {
  const { space, colors } = useTheme();
  const q = useQuery<DispatchState>('dispatch.state', '/dispatch');
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const carrying = !!q.data?.mine.some((m) => m.status === 'PICKED_UP');
  const loc = useLiveLocation(carrying);
  useEffect(() => { const t = setInterval(q.refresh, 20000); return () => clearInterval(t); }, [q.refresh]);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Deliveries" />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {loc.state === 'ask' || loc.state === 'blocked' ? <PermissionPrompt title="Share your location while delivering" why="So the customer can see you are on the way. It is shared only with that customer, only while you carry their order, and cleared when you deliver." blocked={loc.state === 'blocked'} onAllow={() => void loc.allow()} onNotNow={loc.dismiss} /> : null}
      {loc.state === 'sharing' ? <Text variant="small" tone="muted">Sharing your location with the customer until you deliver.</Text> : null}
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(s) => (
          <View style={{ gap: space.md }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{s.profile.online ? 'Available for deliveries' : 'Offline'}</Text>
                <Text variant="small" tone="muted">Up to {s.maxActive} at a time. {formatCedis(s.feePerDelivery)} a delivery.</Text>
              </View>
              <Switch value={s.profile.online} onValueChange={(on) => void run(async () => { await dispatchApi.setOnline(on); q.refresh(); })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Available for deliveries" />
            </Card>
            {s.mine.map((d) => <DeliveryCard key={d.id} d={d} onDone={(m) => { if (m) setMsg(m); q.refresh(); }} />)}
            <Text variant="heading">On offer</Text>
            {!s.profile.online ? <EmptyState title="You are offline" why="Turn on availability above to see deliveries on offer." /> : s.available.length === 0 ? <EmptyState title="Nothing on offer" why="New deliveries appear here when vendors have orders ready. This refreshes every 20 seconds." /> : s.available.map((a) => (
              <Card key={a.id}>
                <Text variant="label">Order {a.number}: {a.vendor.name} to {a.area}</Text>
                <Text variant="small" tone="muted">{a.items} items. You earn {formatCedis(a.fee)}.</Text>
                <Button label="Take it" disabled={s.mine.length >= s.maxActive} loading={busy} onPress={() => void run(async () => { await dispatchApi.take(a.id); setMsg(`Order ${a.number} is yours. Collect it from ${a.vendor.name}.`); q.refresh(); })} />
              </Card>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
