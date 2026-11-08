import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { accommodationApi, type RoomRow, type UniversityHostel } from '@/api/accommodation';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** A hostel's rooms and who is in them; adding a range of rooms at once; changing one room. */
export function Rooms({ hostelId, onBack }: { hostelId: string; onBack: () => void }) {
  const { space } = useTheme();
  const q = useQuery<{ hostel: UniversityHostel; rooms: RoomRow[] }>(`hostels.rooms.${hostelId}`, `/hostels/${hostelId}/rooms`);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);
  return (
    <View style={{ gap: space.md }}>
      <Button label="Back to hostels" variant="ghost" onPress={onBack} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => (
          <>
            <Text variant="heading">{d.hostel.name}: {d.rooms.length} rooms</Text>
            {adding ? <AddRooms hostelId={hostelId} onDone={() => { setAdding(false); q.refresh(); }} /> : <Button label="Add rooms" onPress={() => setAdding(true)} />}
            {editing ? <EditRoom r={editing} onDone={() => { setEditing(null); q.refresh(); }} /> : null}
            {d.rooms.map((r) => {
              const taken = r.allocations.filter((a) => ['PROVISIONAL', 'OFFERED', 'ACCEPTED'].includes(a.status));
              return (
                <Card key={r.id} style={{ padding: 10 }}>
                  <Text variant="label">Room {r.number}{r.floor ? `, floor ${r.floor}` : ''}{r.isActive ? '' : ' (closed)'}</Text>
                  <Text variant="small" tone="muted">{r.roomType}, {taken.length} of {r.capacity} beds taken. {formatCedis(r.pricePerSemester)} a semester.</Text>
                  {taken.map((a) => <Text key={a.id} variant="small">{a.student.firstName} {a.student.lastName} ({a.status.toLowerCase()})</Text>)}
                  <Button label="Change" variant="ghost" onPress={() => setEditing(r)} />
                </Card>
              );
            })}
          </>
        )}
      </QueryView>
    </View>
  );
}

function AddRooms({ hostelId, onDone }: { hostelId: string; onDone: () => void }) {
  const [f, setF] = useState({ prefix: '', from: '1', to: '10', floor: '', capacity: '2', roomType: '2 in a room', price: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const errs = { range: Number.isInteger(Number(f.from)) && Number.isInteger(Number(f.to)) && Number(f.from) >= 1 && Number(f.to) >= Number(f.from) && Number(f.to) - Number(f.from) < 200 ? null : 'Room numbers from and to, at most 200 rooms at once.', capacity: Number.isInteger(Number(f.capacity)) && Number(f.capacity) >= 1 && Number(f.capacity) <= 12 ? null : 'Beds per room from 1 to 12.', price: Number(f.price) > 0 ? null : 'Price a semester in cedis.', roomType: f.roomType.trim() ? null : 'Describe the room, e.g. "2 in a room".' };
  return (
    <Card>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <TextField label="Prefix (optional)" value={f.prefix} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, prefix: x })} placeholder="A for A1, A2" />
      <TextField label="From number" value={f.from} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, from: x })} />
      <TextField label="To number" value={f.to} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, to: x })} error={errs.range} />
      <TextField label="Floor (optional)" value={f.floor} onChangeText={(x) => setF({ ...f, floor: x })} />
      <TextField label="Beds per room" value={f.capacity} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, capacity: x })} error={errs.capacity} />
      <TextField label="Room type" value={f.roomType} onChangeText={(x) => setF({ ...f, roomType: x })} error={errs.roomType} />
      <TextField label="Price a semester (GH₵)" value={f.price} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, price: x })} error={f.price ? errs.price : null} />
      <Button label={`Add rooms ${f.prefix}${f.from} to ${f.prefix}${f.to}`} disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await accommodationApi.addRooms(hostelId, { prefix: f.prefix.trim(), from: Number(f.from), to: Number(f.to), floor: f.floor.trim() || undefined, capacity: Number(f.capacity), roomType: f.roomType.trim(), pricePerSemester: Math.round(Number(f.price) * 100) }); setMsg('Rooms added.'); onDone(); })} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

function EditRoom({ r, onDone }: { r: RoomRow; onDone: () => void }) {
  const [f, setF] = useState({ capacity: String(r.capacity), roomType: r.roomType, price: String(r.pricePerSemester / 100), isActive: r.isActive, notes: r.notes ?? '' });
  const { busy, error, run } = useSubmit();
  const taken = r.allocations.filter((a) => ['PROVISIONAL', 'OFFERED', 'ACCEPTED'].includes(a.status)).length;
  const capError = Number.isInteger(Number(f.capacity)) && Number(f.capacity) >= Math.max(1, taken) && Number(f.capacity) <= 12 ? null : `From ${Math.max(1, taken)} (beds already taken) to 12.`;
  return (
    <Card>
      <Text variant="heading">Room {r.number}</Text>
      <FormError error={error} />
      <TextField label="Beds" value={f.capacity} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, capacity: x })} error={capError} />
      <TextField label="Room type" value={f.roomType} onChangeText={(x) => setF({ ...f, roomType: x })} />
      <TextField label="Price a semester (GH₵)" value={f.price} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, price: x })} error={Number(f.price) > 0 ? null : 'Price in cedis.'} />
      <TextField label="Note (optional)" value={f.notes} onChangeText={(x) => setF({ ...f, notes: x })} placeholder="Window being repaired" />
      <Chip label={f.isActive ? 'Open' : 'Closed (no new students)'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
      <Button label="Save" disabled={!!capError || !(Number(f.price) > 0)} loading={busy} onPress={() => void run(async () => { await accommodationApi.updateRoom(r.id, { capacity: Number(f.capacity), roomType: f.roomType.trim(), pricePerSemester: Math.round(Number(f.price) * 100), isActive: f.isActive, notes: f.notes.trim() || undefined }); onDone(); })} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
