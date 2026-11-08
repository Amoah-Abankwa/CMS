import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { foodApi, type Order } from '@/api/marketplace';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** The next step for an order: accept, ready or on its way, complete with the customer's code, or reject. */
export function OrderActions({ o, onDone }: { o: Order; onDone: () => void }) {
  const { space } = useTheme();
  const [mode, setMode] = useState<null | 'complete' | 'reject'>(null);
  const [value, setValue] = useState('');
  const { busy, error, run } = useSubmit();
  const act = (to: string, extra: { reason?: string; code?: string } = {}) => void run(async () => { await foodApi.act(o.id, to, extra); setMode(null); setValue(''); onDone(); });
  if (mode) {
    const isCode = mode === 'complete';
    const problem = isCode ? (value && !/^\d{4}$/.test(value) ? 'The customer\'s code is 4 digits.' : null) : value && value.trim().length < 5 ? 'Tell the customer why (at least 5 characters).' : null;
    return (
      <View style={{ gap: space.sm }}>
        <FormError error={error} />
        <TextField label={isCode ? "Customer's code" : 'Reason (the customer sees it)'} value={value} keyboardType={isCode ? 'number-pad' : 'default'} maxLength={isCode ? 4 : 200} onChangeText={setValue} error={problem} />
        <Button label={isCode ? 'Complete order' : 'Reject order'} variant={isCode ? 'primary' : 'danger'} disabled={isCode ? !/^\d{4}$/.test(value) : value.trim().length < 5} loading={busy} onPress={() => act(isCode ? 'COMPLETED' : 'REJECTED', isCode ? { code: value } : { reason: value.trim() })} />
        <Button label="Back" variant="ghost" onPress={() => setMode(null)} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <FormError error={error} />
      {o.status === 'PLACED' ? <><Button label="Accept" loading={busy} onPress={() => act('ACCEPTED')} /><Button label="Reject" variant="ghost" onPress={() => setMode('reject')} /></> : null}
      {o.status === 'ACCEPTED' ? <Button label={o.fulfilment === 'PICKUP' || o.viaDispatcher ? 'Ready for collection' : 'Out for delivery'} loading={busy} onPress={() => act(o.fulfilment === 'PICKUP' || o.viaDispatcher ? 'READY' : 'OUT_FOR_DELIVERY')} /> : null}
      {(o.status === 'READY' && !o.viaDispatcher) || (o.status === 'OUT_FOR_DELIVERY' && !o.viaDispatcher) ? <Button label="Complete with the customer's code" onPress={() => setMode('complete')} /> : null}
      {!o.paid && o.paymentOption === 'ON_PICKUP' && o.status !== 'PLACED' ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label={`Paid ${formatCedis(o.total)} cash`} variant="secondary" loading={busy} onPress={() => void run(async () => { await foodApi.markPaid(o.id, 'CASH'); onDone(); })} /></View>
          <View style={{ flex: 1 }}><Button label="Paid by MoMo" variant="secondary" loading={busy} onPress={() => void run(async () => { await foodApi.markPaid(o.id, 'MOMO'); onDone(); })} /></View>
        </View>
      ) : null}
    </View>
  );
}
