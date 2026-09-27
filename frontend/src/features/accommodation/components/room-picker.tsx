'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/input';
import { accommodationApi, type RoomRow, type UniversityHostel } from '../api';

/** Choose a hostel, then a room that still has a free bed. */
export function RoomPicker({ hostels, value, onChange, excludeRoomId }: { hostels: UniversityHostel[]; value: string; onChange: (roomId: string) => void; excludeRoomId?: string }) {
  const [hostelId, setHostelId] = useState('');
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);

  useEffect(() => {
    if (!hostelId) return setRooms(null);
    accommodationApi.rooms(hostelId).then((d) => setRooms(d.rooms)).catch(() => setRooms([]));
  }, [hostelId]);

  const free = rooms?.filter((r) => r.isActive && r.id !== excludeRoomId && r.allocations.length < r.capacity) ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Hostel" htmlFor="pick-hostel">
        <Select id="pick-hostel" value={hostelId} onChange={(e) => { setHostelId(e.target.value); onChange(''); }}>
          <option value="">Choose a hostel</option>
          {hostels.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.gender === 'FEMALE' ? 'female' : 'male'}, {h.free} free)</option>)}
        </Select>
      </Field>
      <Field label="Room" htmlFor="pick-room">
        <Select id="pick-room" value={value} disabled={!rooms} onChange={(e) => onChange(e.target.value)}>
          <option value="">{rooms ? (free.length ? 'Choose a room' : 'No free beds') : 'Choose a hostel first'}</option>
          {free.map((r) => <option key={r.id} value={r.id}>{r.number}, {r.roomType}, {r.capacity - r.allocations.length} of {r.capacity} free</option>)}
        </Select>
      </Field>
    </div>
  );
}
