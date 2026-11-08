import { useState } from 'react';
import { View } from 'react-native';
import { foodApi, type MyVendor } from '@/api/marketplace';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { DAYS, hoursToText, parseDay, type OpeningHours } from '@/lib/hours';
import { useTheme } from '@/theme/useTheme';

export default function ShopSettings() {
  const q = useQuery<MyVendor>('vendor.me', '/vendor');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Shop settings" />
      <QueryView q={q} skeleton={<SkeletonCard lines={8} />}>{(v) => <Settings v={v} onSaved={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Settings({ v, onSaved }: { v: MyVendor; onSaved: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ location: v.location, phone: v.phone, description: v.description ?? '', prep: String(v.prepMinutes), deliveryFee: String(v.deliveryFee / 100), minimum: String(v.minimumOrder / 100), offersPickup: v.offersPickup, offersDelivery: v.offersDelivery, useDispatchers: v.useDispatchers, acceptsOnline: v.acceptsOnline, acceptsPayOnPickup: v.acceptsPayOnPickup, payoutNetwork: v.payoutNetwork ?? '', payoutNumber: v.payoutNumber ?? '', payoutName: v.payoutName ?? '' });
  const [days, setDays] = useState(DAYS.map((_, i) => hoursToText(v.openingHours as OpeningHours, i)));
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const parsed = days.map(parseDay);
  const errs = {
    phone: !/^(\+?233|0)\d{9}$/.test(f.phone.replace(/\s/g, '')) ? 'A Ghana number, e.g. 024 123 4567.' : null,
    prep: !(Number(f.prep) >= 5 && Number(f.prep) <= 180) ? 'Between 5 and 180 minutes.' : null,
    ways: !f.offersPickup && !f.offersDelivery ? 'Offer pick up, delivery or both.' : null,
    pay: !f.acceptsOnline && !f.acceptsPayOnPickup ? 'Accept online payment, payment on collection, or both.' : null,
    momo: f.payoutNumber && !/^(\+?233|0)\d{9}$/.test(f.payoutNumber.replace(/\s/g, '')) ? 'A Ghana mobile money number.' : null,
  };
  if (saved) return <SuccessState title="Settings saved" reassurance="Students see the changes straight away." next="Your opening hours decide when orders can be placed." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  const toggle = (k: 'offersPickup' | 'offersDelivery' | 'useDispatchers' | 'acceptsOnline' | 'acceptsPayOnPickup', label: string) => <Chip label={label} selected={f[k]} onPress={() => setF({ ...f, [k]: !f[k] })} />;
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      <Card>
        <Text variant="heading">Opening hours</Text>
        <Text variant="small" tone="muted">One line a day, like 07:00-15:00. Leave empty if closed.</Text>
        {DAYS.map((d, i) => <TextField key={d} label={d} value={days[i]} onChangeText={(x) => setDays(days.map((y, n) => (n === i ? x : y)))} placeholder="Closed" error={parsed[i].problem} />)}
      </Card>
      <Card>
        <TextField label="Where to find you" value={f.location} onChangeText={(x) => setF({ ...f, location: x })} />
        <TextField label="Phone" value={f.phone} keyboardType="phone-pad" onChangeText={(x) => setF({ ...f, phone: x })} error={touched ? errs.phone : null} />
        <TextField label="About the shop (optional)" value={f.description} onChangeText={(x) => setF({ ...f, description: x })} />
        <TextField label="Usual preparation time (minutes)" value={f.prep} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, prep: x })} error={touched ? errs.prep : null} />
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{toggle('offersPickup', 'Pick up')}{toggle('offersDelivery', 'Delivery')}{f.offersDelivery ? toggle('useDispatchers', 'Use campus dispatchers') : null}</View>
        {touched && errs.ways ? <Text variant="small" tone="danger">{errs.ways}</Text> : null}
        {f.offersDelivery && !f.useDispatchers ? <TextField label="Your delivery fee (GH₵)" value={f.deliveryFee} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, deliveryFee: x })} /> : null}
        <TextField label="Minimum order (GH₵)" value={f.minimum} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, minimum: x })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{toggle('acceptsOnline', 'Online payment')}{toggle('acceptsPayOnPickup', 'Pay on collection')}</View>
        {touched && errs.pay ? <Text variant="small" tone="danger">{errs.pay}</Text> : null}
      </Card>
      <Card>
        <Text variant="heading">Where we pay you</Text>
        <TextField label="Network" value={f.payoutNetwork} onChangeText={(x) => setF({ ...f, payoutNetwork: x })} placeholder="MTN, Telecel or AirtelTigo" />
        <TextField label="Mobile money number" value={f.payoutNumber} keyboardType="phone-pad" onChangeText={(x) => setF({ ...f, payoutNumber: x })} error={touched ? errs.momo : null} />
        <TextField label="Name on the account" value={f.payoutName} onChangeText={(x) => setF({ ...f, payoutName: x })} />
      </Card>
      <Button label="Save settings" loading={busy} onPress={() => {
        setTouched(true);
        if (Object.values(errs).some(Boolean) || parsed.some((p) => p.problem)) return;
        const openingHours: OpeningHours = {};
        parsed.forEach((p, i) => { if (p.periods.length) openingHours[String(i)] = p.periods; });
        void run(async () => {
          await foodApi.saveProfile({ location: f.location.trim(), phone: f.phone.replace(/\s/g, ''), description: f.description.trim() || undefined, openingHours, prepMinutes: Number(f.prep), deliveryFee: Math.round(Number(f.deliveryFee || 0) * 100), minimumOrder: Math.round(Number(f.minimum || 0) * 100), offersPickup: f.offersPickup, offersDelivery: f.offersDelivery, useDispatchers: f.useDispatchers, acceptsOnline: f.acceptsOnline, acceptsPayOnPickup: f.acceptsPayOnPickup, payoutNetwork: f.payoutNetwork.trim() || undefined, payoutNumber: f.payoutNumber.replace(/\s/g, '') || undefined, payoutName: f.payoutName.trim() || undefined });
          setSaved(true); onSaved();
        });
      }} />
    </View>
  );
}
