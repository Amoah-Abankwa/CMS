import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { foodApi, type DispatcherSettlement, type Settlement } from '@/api/marketplace';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const from = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const to = () => new Date().toISOString().slice(0, 10);

export default function Settlements() {
  const { space } = useTheme();
  const [tab, setTab] = useState<'vendors' | 'dispatchers'>('vendors');
  const vendors = useQuery<Settlement[]>('mkt.settle.vendors', '/marketplace/settlements', { from: from(), to: to() });
  const riders = useQuery<DispatcherSettlement[]>('mkt.settle.riders', '/marketplace/dispatcher-settlements', { from: from(), to: to() });
  return (
    <Screen refreshing={vendors.loading} onRefresh={() => { vendors.refresh(); riders.refresh(); }}>
      <Header title="Settlements" subtitle="This month: what online orders collected, and what is owed." />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Vendors" selected={tab === 'vendors'} onPress={() => setTab('vendors')} />
        <Chip label="Dispatchers" selected={tab === 'dispatchers'} onPress={() => setTab('dispatchers')} />
      </View>
      {tab === 'vendors' ? (
        <QueryView q={vendors} skeleton={<SkeletonList rows={4} />}>
          {(list) => list.length === 0 ? <EmptyState title="Nothing this month" why="No online orders have been paid this month." /> : <>{list.map((s) => (
            <Payable key={s.vendor.id} title={s.vendor.name} detail={`${s.onlineOrders} online orders, ${formatCedis(s.onlineGross)}. Commission ${formatCedis(s.commission)}, dispatch ${formatCedis(s.dispatchFees)}. Paid ${formatCedis(s.paidOut)}.`} payTo={s.vendor.payoutNumber ? `${s.vendor.payoutNetwork} ${s.vendor.payoutNumber}` : null} owed={s.owed} onPay={async (amount, reference) => { await foodApi.recordPayout({ vendorId: s.vendor.id, periodFrom: from(), periodTo: to(), amount, reference }); vendors.refresh(); }} />
          ))}</>}
        </QueryView>
      ) : (
        <QueryView q={riders} skeleton={<SkeletonList rows={4} />}>
          {(list) => list.length === 0 ? <EmptyState title="Nothing this month" why="No deliveries were completed this month." /> : <>{list.map((r) => (
            <Payable key={r.id} title={`${r.student.firstName} ${r.student.lastName}`} detail={`${r.deliveries} deliveries, ${formatCedis(r.earned)} earned. Paid ${formatCedis(r.paidOut)}.`} payTo={`${r.payoutNetwork} ${r.payoutNumber}`} owed={r.owed} onPay={async (amount, reference) => { await foodApi.recordDispatcherPayout({ dispatcherId: r.id, periodFrom: from(), periodTo: to(), amount, reference }); riders.refresh(); }} />
          ))}</>}
        </QueryView>
      )}
    </Screen>
  );
}

function Payable({ title, detail, payTo, owed, onPay }: { title: string; detail: string; payTo: string | null; owed: number; onPay: (amount: number, reference?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const { busy, error, run } = useSubmit();
  const n = Number(amount);
  const amountError = amount && (!(n > 0) || Math.round(n * 100) > owed) ? `Up to ${formatCedis(owed)} (what is owed).` : null;
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <Text variant="small" tone="muted">{detail}</Text>
      <Text variant="label">{owed > 0 ? `Owed ${formatCedis(owed)}${payTo ? `, to ${payTo}` : ', no payout number yet'}` : 'Nothing owed'}</Text>
      <FormError error={error} />
      {owed > 0 && !open ? <Button label="Record a payout" variant="secondary" onPress={() => { setAmount(String(owed / 100)); setOpen(true); }} /> : null}
      {open ? (
        <>
          <TextField label="Amount paid (GH₵)" value={amount} keyboardType="decimal-pad" onChangeText={setAmount} error={amountError} />
          <TextField label="MoMo or bank reference (optional)" value={reference} onChangeText={setReference} />
          <Button label="Record payout" disabled={!amount || !!amountError} loading={busy} onPress={() => void run(async () => { await onPay(Math.round(n * 100), reference.trim() || undefined); setOpen(false); })} />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </>
      ) : null}
    </Card>
  );
}
