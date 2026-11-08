import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { formatCedis } from '@anu/shared';
import { foodApi, type MyMealPlan, type VendorMenu } from '@/api/marketplace';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { openPayment } from '@/lib/pay';
import { useTheme } from '@/theme/useTheme';

/** Pickup or delivery, how to pay, then place the order. Everything the vendor needs is checked first. */
export function Checkout({ menu, lines, subtotal, plans, onPlaced }: { menu: VendorMenu; lines: Array<{ menuItemId: string; quantity: number }>; subtotal: number; plans: MyMealPlan[]; onPlaced: () => void }) {
  const { space } = useTheme();
  const [fulfilment, setFulfilment] = useState<'PICKUP' | 'DELIVERY'>(menu.offersPickup ? 'PICKUP' : 'DELIVERY');
  const delivery = fulfilment === 'DELIVERY';
  const onlineOnly = delivery && menu.useDispatchers;
  const [payment, setPayment] = useState<'ONLINE' | 'ON_PICKUP'>(menu.acceptsOnline ? 'ONLINE' : 'ON_PICKUP');
  const [address, setAddress] = useState(menu.defaultAddress ?? '');
  const [touched, setTouched] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const fee = delivery ? (menu.useDispatchers ? menu.dispatchFee : menu.deliveryFee) : 0;
  const pay = onlineOnly ? 'ONLINE' : payment;
  const short = menu.minimumOrder - subtotal;
  const addressError = touched && delivery && address.trim().length < 3 ? 'Say where to bring it: hall and room, or a landmark.' : null;
  const place = () => {
    setTouched(true);
    if ((delivery && address.trim().length < 3) || short > 0) return;
    void run(async () => {
      const r = await foodApi.place({ vendorId: menu.id, lines, fulfilment, paymentOption: pay, deliveryAddress: delivery ? address.trim() : undefined, mealPlanPurchaseId: planId ?? undefined });
      if (r.paymentUrl) await openPayment(r.paymentUrl);
      onPlaced();
      router.replace(`/food/orders/${r.orderId}` as never);
    });
  };
  return (
    <Card>
      <Text variant="heading">Your order: {formatCedis(subtotal + fee)}</Text>
      {short > 0 ? <Text tone="warning">Add {formatCedis(short)} more: {menu.name}'s minimum order is {formatCedis(menu.minimumOrder)}.</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {menu.offersPickup ? <Chip label="Pick up" selected={!delivery} onPress={() => setFulfilment('PICKUP')} /> : null}
        {menu.offersDelivery ? <Chip label={`Deliver (+${formatCedis(menu.useDispatchers ? menu.dispatchFee : menu.deliveryFee)})`} selected={delivery} onPress={() => setFulfilment('DELIVERY')} /> : null}
      </View>
      {delivery ? <TextField label="Deliver to" value={address} onChangeText={setAddress} onBlur={() => setTouched(true)} placeholder="Grace Hall, room G14" error={addressError ?? error?.fields.deliveryAddress} /> : null}
      {onlineOnly ? <Text variant="small" tone="muted">Campus deliveries are paid online.</Text> : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {menu.acceptsOnline ? <Chip label="Pay online" selected={payment === 'ONLINE'} onPress={() => setPayment('ONLINE')} /> : null}
          {menu.acceptsPayOnPickup && !delivery ? <Chip label="Pay when collecting" selected={payment === 'ON_PICKUP'} onPress={() => setPayment('ON_PICKUP')} /> : null}
        </View>
      )}
      {plans.length ? <Chip label={planId ? `Using a meal from ${plans[0].plan.name}` : `Use a meal from ${plans[0].plan.name} (${plans[0].mealsLeft} left)`} selected={!!planId} onPress={() => setPlanId(planId ? null : plans[0].id)} /> : null}
      <FormError error={error} />
      <Button label={pay === 'ONLINE' ? 'Place order and pay' : 'Place order'} loading={busy} disabled={!lines.length} onPress={place} />
    </Card>
  );
}
