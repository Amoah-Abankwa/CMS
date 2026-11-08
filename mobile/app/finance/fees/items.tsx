import { useState } from 'react';
import { feesApi, type FeeItem } from '@/api/fees';
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

export default function FeeItems() {
  const q = useQuery<FeeItem[]>('fees.items', '/fees/items');
  const [editing, setEditing] = useState<FeeItem | 'new' | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Fee items" subtitle="The Accounts office's names for each charge. Every schedule line uses one." />
      {editing ? <ItemForm item={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : <Button label="Add a fee item" onPress={() => setEditing('new')} />}
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(list) => list.length === 0 ? <EmptyState title="No fee items" why="Add items such as Tuition, Library and ICT before making schedules." /> : <>{list.map((i) => (
          <Card key={i.id} style={{ padding: 10 }}>
            <Text variant="label">{i.name}{i.isActive ? '' : ' (not in use)'}</Text>
            <Text variant="small" tone="muted">{i.description ?? ''} Used on {i._count.lines} schedule lines.</Text>
            <Button label="Edit" variant="ghost" onPress={() => setEditing(i)} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}

function ItemForm({ item, onDone }: { item: FeeItem | null; onDone: () => void }) {
  const [f, setF] = useState({ name: item?.name ?? '', description: item?.description ?? '', isActive: item?.isActive ?? true });
  const { busy, error, run } = useSubmit();
  const nameError = f.name && f.name.trim().length < 2 ? 'Give the item a name.' : null;
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={nameError} />
      <TextField label="Description (optional)" value={f.description} onChangeText={(x) => setF({ ...f, description: x })} />
      {item ? <Chip label={f.isActive ? 'In use' : 'Not in use'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} /> : null}
      <Button label="Save" disabled={f.name.trim().length < 2} loading={busy} onPress={() => void run(async () => { await feesApi.saveItem({ name: f.name.trim(), description: f.description.trim() || undefined, isActive: f.isActive }, item?.id); onDone(); })} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
