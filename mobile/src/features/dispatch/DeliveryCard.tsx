import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { dispatchApi, type DispatchState } from '@/api/employment';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

type Mine = DispatchState['mine'][number];

/** A delivery you have taken: picked up, delivered with the customer's code, or a problem. */
export function DeliveryCard({ d, onDone }: { d: Mine; onDone: (msg?: string) => void }) {
  const { space } = useTheme();
  const [mode, setMode] = useState<null | 'code' | 'problem'>(null);
  const [value, setValue] = useState('');
  const { busy, error, run } = useSubmit();
  const done = (fn: () => Promise<unknown>, msg?: string) => void run(async () => { await fn(); setMode(null); setValue(''); onDone(msg); });
  return (
    <Card>
      <Text variant="heading">Order {d.order.number}, {d.order.vendor.name}</Text>
      <Text>To {d.order.deliveryAddress}{d.order.deliveryNote ? `. ${d.order.deliveryNote}` : ''}</Text>
      <Text variant="small" tone="muted">You earn {formatCedis(d.fee)}. {d.status === 'PICKED_UP' ? 'On the way.' : 'Collect it from the vendor.'}</Text>
      {d.problemNote ? <Text variant="small" tone="warning">Problem reported: {d.problemNote}</Text> : null}
      <FormError error={error} />
      {mode === 'code' ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Customer's 4-digit code" value={value} keyboardType="number-pad" maxLength={4} onChangeText={setValue} error={value && !/^\d{4}$/.test(value) ? 'The code is 4 digits.' : null} />
          <Button label="Delivered" disabled={!/^\d{4}$/.test(value)} loading={busy} onPress={() => done(async () => { const r = await dispatchApi.delivered(d.id, value); return r; }, 'Delivered. Your earnings are updated.')} />
          <Button label="Back" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : mode === 'problem' ? (
        <View style={{ gap: space.sm }}>
          <TextField label="What is wrong" value={value} onChangeText={setValue} placeholder="Customer not answering the phone" error={value && value.trim().length < 5 ? 'Say briefly what happened (at least 5 characters).' : null} />
          <Button label="Report the problem" variant="danger" disabled={value.trim().length < 5} loading={busy} onPress={() => done(() => dispatchApi.problem(d.id, value.trim()), 'Problem reported to the vendor.')} />
          <Button label="Back" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {d.status === 'ASSIGNED' ? <Button label="I have collected it" loading={busy} onPress={() => done(() => dispatchApi.pickedUp(d.id))} /> : <Button label="Delivered: enter the code" onPress={() => setMode('code')} />}
          <Button label="Report a problem" variant="ghost" onPress={() => setMode('problem')} />
          {d.status === 'ASSIGNED' ? <Button label="Give it back" variant="ghost" loading={busy} onPress={() => done(() => dispatchApi.release(d.id))} /> : null}
        </View>
      )}
    </Card>
  );
}
