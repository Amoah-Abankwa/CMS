import { useState } from 'react';
import type { UniversityHostel } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { HostelForm } from '@/features/hostels/HostelForm';
import { Rooms } from '@/features/hostels/Rooms';
import { useQuery } from '@/hooks/useQuery';

export default function UniversityHostels() {
  const q = useQuery<{ semester: { label: string }; items: UniversityHostel[] }>('hostels.list', '/hostels');
  const [editing, setEditing] = useState<UniversityHostel | 'new' | null>(null);
  const [rooms, setRooms] = useState<string | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="University hostels" subtitle={q.data?.semester.label} />
      {editing ? <HostelForm h={editing === 'new' ? null : editing} onDone={() => { setEditing(null); q.refresh(); }} /> : rooms ? <Rooms hostelId={rooms} onBack={() => { setRooms(null); q.refresh(); }} /> : (
        <>
          <Button label="Add a hostel" onPress={() => setEditing('new')} />
          <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
            {(d) => d.items.length === 0 ? <EmptyState title="No hostels yet" why="Add each university hall, then its rooms." /> : <>{d.items.map((h) => (
              <Card key={h.id}>
                <Text variant="heading">{h.name}{h.isActive === false ? ' (closed)' : ''}</Text>
                <Text variant="small" tone="muted">{h.gender === 'FEMALE' ? 'Women' : h.gender === 'MALE' ? 'Men' : 'Mixed'}. {h.rooms} rooms, {h.beds} beds: {h.accepted} accepted, {h.offered} offered, {h.provisional} provisional, {h.free} free.</Text>
                <Button label="Rooms" variant="secondary" onPress={() => setRooms(h.id)} />
                <Button label="Edit" variant="ghost" onPress={() => setEditing(h)} />
              </Card>
            ))}</>}
          </QueryView>
        </>
      )}
    </Screen>
  );
}
