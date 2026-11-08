import { useState } from 'react';
import { formatCedis } from '@anu/shared';
import { feesApi, type Patronage } from '@/api/fees';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

/** The patron (a Head of Department) sets each semester's dues and opens or closes collection. */
export default function PatronDues() {
  const q = useQuery<Patronage[]>('patron.list', '/dues-patron');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Departmental dues" subtitle="As patron, you set the association's dues." />
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="You are not a patron" why="The Dean of Students office names a Head of Department as each association's patron." /> : <>{list.map((a) => <Association key={a.id} a={a} onChange={q.refresh} />)}</>}
      </QueryView>
    </Screen>
  );
}

function Association({ a, onChange }: { a: Patronage; onChange: () => void }) {
  const [f, setF] = useState({ title: '', amount: '', dueOn: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { title: f.title.trim().length < 3 ? 'Name the dues, e.g. "Semester dues".' : null, amount: !(Number(f.amount) > 0) ? 'Amount in cedis, e.g. 50.' : null, dueOn: !/^\d{4}-\d{2}-\d{2}$/.test(f.dueOn) ? 'Due date as YYYY-MM-DD.' : null };
  return (
    <Card>
      <Text variant="heading">{a.code}: {a.name}</Text>
      <Text variant="small" tone="muted">{a.departments.join(', ')}. {a.members} students.</Text>
      {a.levies.map((l) => (
        <Card key={l.id} style={{ padding: 10 }}>
          <Text variant="label">{l.title}: {formatCedis(l.amount)}, due {new Date(l.dueOn).toLocaleDateString()}</Text>
          <Text variant="small" tone="muted">{l.paidCount} of {a.members} paid.</Text>
          <Button label={l.isOpen ? 'Close collection' : 'Reopen collection'} variant="ghost" loading={busy} onPress={() => void run(async () => { await feesApi.setLevyOpen(l.id, !l.isOpen); onChange(); })} />
        </Card>
      ))}
      <FormError error={error} />
      {done ? <SuccessState title="Dues set" reassurance="Students can pay online now, and officers can record cash." next="The officers have been told." action={{ label: 'Set more dues', onPress: () => setDone(false) }} /> : (
        <>
          <TextField label="Dues" value={f.title} onChangeText={(x) => setF({ ...f, title: x })} error={touched ? errs.title : null} />
          <TextField label="Amount (GH₵)" value={f.amount} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, amount: x })} error={touched ? errs.amount : null} />
          <TextField label="Due by" value={f.dueOn} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...f, dueOn: x })} error={touched ? errs.dueOn : null} />
          <Button label="Set dues" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await feesApi.createLevy(a.id, { title: f.title.trim(), amount: Math.round(Number(f.amount) * 100), dueOn: f.dueOn }); setF({ title: '', amount: '', dueOn: '' }); setTouched(false); setDone(true); onChange(); }); }} />
        </>
      )}
    </Card>
  );
}
