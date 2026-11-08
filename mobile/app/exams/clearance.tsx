import { useState } from 'react';
import { View } from 'react-native';
import { examsApi, type ClearanceView } from '@/api/exams';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
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

export default function Clearance() {
  const { space } = useTheme();
  const [status, setStatus] = useState<'NOT_CLEARED' | 'CLEARED'>('NOT_CLEARED');
  const q = useQuery<ClearanceView>(`exams.clearance.${status}`, '/exams/clearance', { status, page: 1, pageSize: 50 });
  const [indexes, setIndexes] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const list = indexes.split(/[\s,;]+/).filter(Boolean);
  const bad = list.filter((i) => !/^[A-Za-z]{2,6}\d{6,9}$/.test(i));
  const set = (cleared: boolean) => void run(async () => { const r = await examsApi.setClearance(list.map((i) => i.toUpperCase()), cleared, note.trim() || undefined); setMsg(`${r.updated} updated.${r.notFound.length ? ` Not found: ${r.notFound.join(', ')}.` : ''}`); setIndexes(''); q.refresh(); });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Fee clearance" subtitle={q.data ? `${q.data.counts.cleared} cleared, ${q.data.counts.notCleared} not cleared.` : undefined} />
      <Card>
        <FormError error={error} />
        {msg ? <Notice tone="success">{msg}</Notice> : null}
        <TextField label="Index numbers" value={indexes} multiline onChangeText={setIndexes} placeholder="ANU25400001, ANU25400002" error={bad.length ? `Check: ${bad.slice(0, 3).join(', ')}.` : null} />
        <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Paid at the bank on 3 November" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label="Clear them" disabled={!list.length || bad.length > 0} loading={busy} onPress={() => set(true)} /></View>
          <View style={{ flex: 1 }}><Button label="Not cleared" variant="secondary" disabled={!list.length || bad.length > 0} loading={busy} onPress={() => set(false)} /></View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Not cleared" selected={status === 'NOT_CLEARED'} onPress={() => setStatus('NOT_CLEARED')} />
        <Chip label="Cleared" selected={status === 'CLEARED'} onPress={() => setStatus('CLEARED')} />
      </View>
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nobody here" why={status === 'NOT_CLEARED' ? 'Every student is cleared for exams.' : 'Nobody is cleared yet.'} /> : <>{d.items.map((s) => (
          <Card key={s.id} style={{ padding: 10 }}>
            <Text variant="label">{s.firstName} {s.lastName} <Text variant="small" tone="muted">{s.indexNumber}</Text></Text>
            {s.clearance?.cleared ? <Badge label="Cleared" tone="success" /> : <Badge label="Not cleared" tone="warning" />}
            {s.clearance?.note ? <Text variant="small" tone="muted">{s.clearance.note}</Text> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
