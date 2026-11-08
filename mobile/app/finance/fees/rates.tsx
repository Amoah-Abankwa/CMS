import { useState } from 'react';
import { feesApi, type ExchangeRate } from '@/api/fees';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

export default function Rates() {
  const q = useQuery<ExchangeRate[]>('fees.rates', '/fees/rates');
  const [f, setF] = useState({ rate: '', from: new Date().toISOString().slice(0, 10), note: '' });
  const { busy, error, run } = useSubmit();
  const errs = { rate: Number(f.rate) > 0 && Number(f.rate) < 1000 ? null : 'Cedis to one dollar, e.g. 15.40.', from: /^\d{4}-\d{2}-\d{2}$/.test(f.from) ? null : 'YYYY-MM-DD.' };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exchange rates" subtitle="Used when a student pays a dollar bill in cedis, from the date given." />
      <Card>
        <FormError error={error} />
        <TextField label="Cedis per dollar" value={f.rate} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, rate: x.replace(',', '.') })} error={f.rate ? errs.rate : null} />
        <TextField label="From" value={f.from} onChangeText={(x) => setF({ ...f, from: x })} error={errs.from} />
        <TextField label="Note (optional)" value={f.note} onChangeText={(x) => setF({ ...f, note: x })} placeholder="Bank of Ghana rate" />
        <Button label="Add rate" disabled={!f.rate || Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await feesApi.addRate({ cedisPerDollar: Number(f.rate), effectiveFrom: f.from, note: f.note.trim() || undefined }); setF({ ...f, rate: '', note: '' }); q.refresh(); })} />
      </Card>
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No rates yet" why="Without a rate, dollar bills can only be paid in dollars." /> : <>{list.map((r) => (
          <Card key={r.id} style={{ padding: 10 }}>
            <Text variant="label">GH₵ {r.cedisPerDollar.toFixed(2)} to US$ 1, from {r.effectiveFrom.slice(0, 10)}</Text>
            {r.note ? <Text variant="small" tone="muted">{r.note}</Text> : null}
            <Button label="Remove" variant="ghost" loading={busy} onPress={() => void run(async () => { await feesApi.deleteRate(r.id); q.refresh(); })} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
