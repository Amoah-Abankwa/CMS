import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { libraryApi, type FineRow } from '@/api/library';
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

export default function Fines() {
  const [search, setSearch] = useState('');
  const q = useQuery<{ items: FineRow[] }>(`lib.fines.${search}`, '/library/fines', { status: 'OUTSTANDING', search: search.trim() || undefined, page: 1, pageSize: 50 });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Library fines" subtitle="Outstanding fines: take payment or waive." />
      <TextField label="Find a borrower" value={search} onChangeText={setSearch} placeholder="Name or index number" />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No outstanding fines" why={search ? `Nobody matching "${search}" owes anything.` : 'Every fine is settled.'} /> : <>{d.items.map((f) => <FineCard key={f.id} f={f} onDone={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function FineCard({ f, onDone }: { f: FineRow; onDone: () => void }) {
  const { space } = useTheme();
  const [mode, setMode] = useState<null | 'pay' | 'waive'>(null);
  const [v, setV] = useState({ amount: String(f.outstanding / 100), method: 'CASH' as 'CASH' | 'MOBILE_MONEY', receipt: '', reason: '' });
  const { busy, error, run } = useSubmit();
  const n = Number(v.amount);
  const amountError = !(n > 0) || Math.round(n * 100) > f.outstanding ? `From GH₵ 0.01 to ${formatCedis(f.outstanding)}.` : null;
  return (
    <Card>
      <Text variant="label">{f.borrower.firstName} {f.borrower.lastName} <Text variant="small" tone="muted">{f.borrower.indexNumber}</Text></Text>
      <Text variant="small" tone="muted">{f.reason === 'OVERDUE' ? 'Late return' : f.reason === 'LOST' ? 'Lost book' : 'Damaged book'}{f.note ? `: ${f.note}` : ''}. {formatCedis(f.outstanding)} of {formatCedis(f.amount)} outstanding.</Text>
      <FormError error={error} />
      {mode ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Amount (GH₵)" value={v.amount} keyboardType="decimal-pad" onChangeText={(x) => setV({ ...v, amount: x })} error={amountError} />
          {mode === 'pay' ? (
            <>
              <View style={{ flexDirection: 'row', gap: space.sm }}><Chip label="Cash" selected={v.method === 'CASH'} onPress={() => setV({ ...v, method: 'CASH' })} /><Chip label="MoMo" selected={v.method === 'MOBILE_MONEY'} onPress={() => setV({ ...v, method: 'MOBILE_MONEY' })} /></View>
              <TextField label="Receipt number (optional)" value={v.receipt} onChangeText={(x) => setV({ ...v, receipt: x })} />
              <Button label="Record payment" disabled={!!amountError} loading={busy} onPress={() => void run(async () => { await libraryApi.pay(f.id, Math.round(n * 100), v.method, v.receipt.trim() || undefined); onDone(); })} />
            </>
          ) : (
            <>
              <TextField label="Why it is waived (recorded)" value={v.reason} onChangeText={(x) => setV({ ...v, reason: x })} error={v.reason && v.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
              <Button label="Waive" variant="danger" disabled={!!amountError || v.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await libraryApi.waive(f.id, v.reason.trim(), Math.round(n * 100)); onDone(); })} />
            </>
          )}
          <Button label="Cancel" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label="Take payment" onPress={() => setMode('pay')} /></View>
          <View style={{ flex: 1 }}><Button label="Waive" variant="secondary" onPress={() => setMode('waive')} /></View>
        </View>
      )}
    </Card>
  );
}
