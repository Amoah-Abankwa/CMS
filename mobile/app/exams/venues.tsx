import { useState } from 'react';
import { examsApi, type Venue } from '@/api/exams';
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

export default function Venues() {
  const q = useQuery<Venue[]>('exams.venues', '/exams/venues');
  const [editing, setEditing] = useState<Venue | 'new' | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam venues" subtitle="Halls and rooms for exams, with their seats." />
      {editing ? <VenueForm v={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : <Button label="Add a venue" onPress={() => setEditing('new')} />}
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No venues yet" why="Add the halls exams can use, with how many students each seats." /> : <>{list.map((v) => (
          <Card key={v.id} style={{ padding: 12 }}>
            <Text variant="label">{v.name}: {v.capacity} seats{v.isActive ? '' : ' (not in use)'}</Text>
            {v.location ? <Text variant="small" tone="muted">{v.location}</Text> : null}
            <Button label="Edit" variant="ghost" onPress={() => setEditing(v)} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}

function VenueForm({ v, onDone }: { v: Venue | null; onDone: () => void }) {
  const [f, setF] = useState({ name: v?.name ?? '', capacity: v ? String(v.capacity) : '', location: v?.location ?? '', isActive: v?.isActive ?? true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { name: f.name.trim().length < 2 ? 'Give the venue a name.' : null, capacity: !(Number.isInteger(Number(f.capacity)) && Number(f.capacity) >= 1) ? 'How many students it seats for an exam (a whole number).' : null };
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <TextField label="Exam seats" value={f.capacity} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, capacity: x })} error={touched ? errs.capacity : null} />
      <TextField label="Where (optional)" value={f.location} onChangeText={(x) => setF({ ...f, location: x })} />
      <Chip label={f.isActive ? 'In use' : 'Not in use'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!errs.name && !errs.capacity) void run(async () => { await examsApi.saveVenue({ name: f.name.trim(), capacity: Number(f.capacity), location: f.location.trim() || null, isActive: f.isActive }, v?.id); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
