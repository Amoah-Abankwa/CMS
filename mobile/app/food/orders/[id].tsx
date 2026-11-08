import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatCedis, ORDER_STATUS_LABEL } from '@anu/shared';
import { foodApi, type Order } from '@/api/marketplace';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { PaymentStarted } from '@/components/states/PaymentStarted';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Stars } from '@/features/food/Stars';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { openPayment } from '@/lib/pay';
import { useTheme } from '@/theme/useTheme';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Order>(`food.order.${id}`, `/food/orders/${id}`);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? `Order ${q.data.number}` : 'Order'} subtitle={q.data?.vendor.name} />
      <QueryView q={q} skeleton={<SkeletonCard lines={5} />}>{(o) => <OrderView o={o} refresh={q.refresh} />}</QueryView>
    </Screen>
  );
}

function OrderView({ o, refresh }: { o: Order; refresh: () => void }) {
  const { space } = useTheme();
  const { busy, error, run } = useSubmit();
  const [paying, setPaying] = useState(false);
  const [stars, setStars] = useState({ vendor: 0, dispatcher: 0 });
  const [rated, setRated] = useState(false);
  if (paying) return <PaymentStarted what={`order ${o.number}`} onRefresh={() => { setPaying(false); refresh(); }} />;
  const rider = o.delivery?.dispatcher;
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <Text variant="heading">{ORDER_STATUS_LABEL[o.status]}</Text>
        {o.pickupCode && (o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY') ? <Text variant="title">Code {o.pickupCode}</Text> : null}
        {o.pickupCode ? <Text variant="small" tone="muted">Show this code when you collect or receive the food.</Text> : null}
        {o.cancelReason ? <Text tone="muted">{o.cancelReason}</Text> : null}
        {rider && o.status === 'OUT_FOR_DELIVERY' ? <Text>{rider.student.firstName} is bringing it by {rider.transport.toLowerCase()}{rider.student.phone ? `, ${rider.student.phone}` : ''}.{rider.location ? ` Last seen ${new Date(rider.location.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</Text> : null}
      </Card>
      <Card>
        {o.items.map((i) => <Text key={i.name}>{i.quantity} x {i.name}: {formatCedis(i.lineTotal)}</Text>)}
        {o.deliveryFee ? <Text variant="small" tone="muted">Delivery {formatCedis(o.deliveryFee)}</Text> : null}
        <Text variant="label">Total {formatCedis(o.total)}{o.paid ? ', paid' : ''}</Text>
      </Card>
      <FormError error={error} />
      {!o.paid && o.paymentOption === 'ONLINE' && (o.status === 'PENDING_PAYMENT' || o.status === 'PLACED') ? <Button label="Pay now" loading={busy} onPress={() => void run(async () => { await openPayment((await foodApi.pay(o.id)).paymentUrl); setPaying(true); })} /> : null}
      {o.status === 'PENDING_PAYMENT' || o.status === 'PLACED' ? <Button label="Cancel order" variant="ghost" loading={busy} onPress={() => void run(async () => { await foodApi.cancel(o.id); refresh(); })} /> : null}
      {o.status === 'COMPLETED' && !o.rating ? (rated ? <SuccessState title="Thanks for rating" reassurance="Your rating helps other students choose." next="Vendors see the average, not who rated." /> : (
        <Card>
          <Text variant="heading">How was it?</Text>
          <Stars label="The food and vendor" value={stars.vendor} onChange={(n) => setStars({ ...stars, vendor: n })} />
          {o.delivery?.dispatcherId ? <><Text variant="small" tone="muted">The delivery</Text><Stars label="The delivery" value={stars.dispatcher} onChange={(n) => setStars({ ...stars, dispatcher: n })} /></> : null}
          <Button label="Send rating" disabled={!stars.vendor} loading={busy} onPress={() => void run(async () => { await foodApi.rate(o.id, { vendorStars: stars.vendor, dispatcherStars: stars.dispatcher || undefined }); setRated(true); })} />
        </Card>
      )) : null}
      {o.status === 'CANCELLED' || o.status === 'REJECTED' ? <Notice tone="info" title="Nothing to pay">If you had paid online, the refund goes back to the same account.</Notice> : null}
    </View>
  );
}
