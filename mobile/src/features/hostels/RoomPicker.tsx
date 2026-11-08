import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { RoomRow, UniversityHostel } from '@/api/accommodation';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

/** Choosing a room with a free bed: the hostel first, then its rooms. */
export function RoomPicker({ hostels, value, onChange }: { hostels: UniversityHostel[]; value: string | null; onChange: (roomId: string) => void }) {
  const { space } = useTheme();
  const [hostelId, setHostelId] = useState<string | null>(null);
  const rooms = useQuery<{ rooms: RoomRow[] }>(`hostels.rooms.${hostelId ?? 'none'}`, hostelId ? `/hostels/${hostelId}/rooms` : '/hostels');
  const free = (r: RoomRow) => r.capacity - r.allocations.filter((a) => ['PROVISIONAL', 'OFFERED', 'ACCEPTED'].includes(a.status)).length;
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{hostels.map((h) => <Chip key={h.id} label={`${h.name} (${h.free} free)`} selected={hostelId === h.id} onPress={() => setHostelId(h.id)} />)}</ScrollView>
      {hostelId && rooms.data?.rooms ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {rooms.data.rooms.filter((r) => r.isActive && free(r) > 0).map((r) => <Chip key={r.id} label={`${r.number} (${free(r)} free)`} selected={value === r.id} onPress={() => onChange(r.id)} />)}
        </ScrollView>
      ) : null}
      {hostelId && rooms.data?.rooms && !rooms.data.rooms.some((r) => r.isActive && free(r) > 0) ? <Text variant="small" tone="warning">No free beds in this hostel.</Text> : null}
    </View>
  );
}
