import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
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
import { axiosInstance } from '@/lib/api';
import { openPdf } from '@/lib/files';
import { useTheme } from '@/theme/useTheme';

type Method = 'CASH' | 'MOBILE_MONEY' | 'BANK';
interface Fee { id: string; description: string; amount: number; paid: number; balance: number; hostel: { name: string }; student: { firstName: string; lastName: string; indexNumber: string | null }; payments: Array<{ id: string; amount: number; method: string; receiptNumber: string; reversedAt: string | null }> }

export default function HostelFees() {
  const [unpaidOnly, setUnpaidOnly] = useState(true);
  const q = useQuery<{ rows: Fee[]; totals: { due: number; paid: number } }>(`owner.fees.${unpaidOnly}`, '/hostel-fees', { unpaidOnly });
  const { space } = useTheme();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Hostel fees" subtitle={q.data ? `${formatCedis(q.data.totals.paid)} paid of ${formatCedis(q.data.totals.due)}` : undefined} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Still owing" selected={unpaidOnly} onPress={() => setUnpaidOnly(true)} />
        <Chip label="Everyone" selected={!unpaidOnly} onPress={() => setUnpaidOnly(false)} />
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => d.rows.length === 0 ? <EmptyState title={unpaidOnly ? 'Nobody owes anything' : 'No fees yet'} why={unpaidOnly ? 'Every resident has paid in full.' : 'Fees appear once residents are checked in.'} action={unpaidOnly ? { label: 'Show everyone', onPress: () => setUnpaidOnly(false) } : undefined} /> : <>{d.rows.map((f) => <FeeCard key={f.id} f={f} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function FeeCard({ f, onDone }: { f: Fee; onDone: () => void }) {
  const { space } = useTheme();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('CASH');
  const [reference, setReference] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const n = Number(amount);
  const amountError = amount && (!(n > 0) || n * 100 > f.balance) ? `Between GH₵ 0.01 and ${formatCedis(f.balance)} (what is still owed).` : null;
  const refError = method !== 'CASH' && reference.trim().length < 4 ? 'Give the transaction reference from the MoMo or bank slip.' : null;
  if (done) return <SuccessState title="Payment recorded" reassurance={done} next="The student gets a receipt by notification." action={{ label: 'Done', onPress: () => { setDone(null); onDone(); } }} />;
  return (
    <Card>
      <Text variant="label">{f.student.firstName} {f.student.lastName} <Text variant="small" tone="muted">{f.student.indexNumber}</Text></Text>
      <Text variant="small" tone="muted">{f.description}. Paid {formatCedis(f.paid)} of {formatCedis(f.amount)}.</Text>
      {f.payments.filter((p) => !p.reversedAt).map((p) => <Button key={p.id} label={`Receipt ${p.receiptNumber} (PDF)`} variant="ghost" onPress={() => void run(() => openPdf(`/hostel-fees/payments/${p.id}/pdf`, `receipt-${p.receiptNumber}.pdf`))} />)}
      <FormError error={error} />
      {f.balance > 0 && !open ? <Button label="Record a payment" variant="secondary" onPress={() => setOpen(true)} /> : null}
      {open ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Amount (GH₵)" value={amount} keyboardType="decimal-pad" onChangeText={(x) => setAmount(x.replace(',', '.'))} error={amountError} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['CASH', 'MOBILE_MONEY', 'BANK'] as Method[]).map((m) => <Chip key={m} label={m === 'CASH' ? 'Cash' : m === 'MOBILE_MONEY' ? 'MoMo' : 'Bank'} selected={method === m} onPress={() => setMethod(m)} />)}
          </View>
          {method !== 'CASH' ? <TextField label="Reference" value={reference} onChangeText={setReference} error={reference ? refError : null} /> : null}
          <Button label="Record" disabled={!amount || !!amountError || !!refError} loading={busy} onPress={() => void run(async () => {
            await axiosInstance.post(`/hostel-fees/${f.id}/payments`, { amount: Math.round(n * 100), method, reference: reference.trim() || undefined, paidOn: new Date().toISOString().slice(0, 10) });
            setDone(`${formatCedis(Math.round(n * 100))} from ${f.student.firstName} recorded.`);
          })} />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </Card>
  );
}
