import { useState } from 'react';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
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
import { axiosInstance } from '@/lib/api';

interface Exemption { reason: string; createdAt: string; student: { id: string; firstName: string; lastName: string; indexNumber: string | null } }

export default function Exemptions() {
  const q = useQuery<Exemption[]>('chapel.exemptions', '/devotion/exemptions');
  const [f, setF] = useState({ indexNumber: '', reason: '' });
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const errs = { index: !/^[A-Za-z]{2,6}\d{6,9}$/.test(f.indexNumber.trim()) ? 'An index number looks like ANU25400001.' : null, reason: f.reason.trim().length < 5 ? 'Say why (at least 5 characters).' : null };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Devotion exemptions" subtitle="Students excused from morning devotion this semester." />
      <Card>
        <FormError error={error} />
        {msg ? <Notice tone="success">{msg}</Notice> : null}
        <TextField label="Index number" value={f.indexNumber} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, indexNumber: x })} error={touched ? errs.index : null} />
        <TextField label="Reason" value={f.reason} onChangeText={(x) => setF({ ...f, reason: x })} error={touched ? errs.reason : null} />
        <Button label="Exempt" loading={busy} onPress={() => { setTouched(true); if (!errs.index && !errs.reason) void run(async () => { await axiosInstance.post('/devotion/exemptions', { indexNumber: f.indexNumber.trim().toUpperCase(), reason: f.reason.trim() }); setMsg(`${f.indexNumber.toUpperCase()} exempted for this semester.`); setF({ indexNumber: '', reason: '' }); setTouched(false); q.refresh(); }); }} />
      </Card>
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nobody exempted" why="Every student is expected at devotion this semester." /> : <>{list.map((e) => (
          <Card key={e.student.id} style={{ padding: 10 }}>
            <Text variant="label">{e.student.firstName} {e.student.lastName} <Text variant="small" tone="muted">{e.student.indexNumber}</Text></Text>
            <Text variant="small">{e.reason}</Text>
            <Button label="Remove" variant="ghost" loading={busy} onPress={() => void run(async () => { await axiosInstance.delete(`/devotion/exemptions/${e.student.id}`); q.refresh(); })} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
