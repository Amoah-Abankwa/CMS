import { View } from 'react-native';
import { accommodationApi, type OwnerBooking, type PrivateHostel } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { RoomTypeRow } from '@/features/owner/RoomTypeRow';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

const VERIFY = { PENDING: ['Waiting for the Hostels Office to verify', 'warning'], APPROVED: ['Verified: students can see it', 'success'], REJECTED: ['Not verified', 'danger'], SUSPENDED: ['Suspended', 'danger'] } as const;

export default function MyHostel() {
  const { space } = useTheme();
  const hostels = useQuery<PrivateHostel[]>('owner.hostels', '/my-hostels');
  const bookings = useQuery<OwnerBooking[]>('owner.bookings', '/my-hostels/bookings', { status: 'REQUESTED' });
  const respond = async (id: string, accept: boolean, note?: string) => { await accommodationApi.respondBooking(id, accept, note); bookings.refresh(); hostels.refresh(); };
  return (
    <Screen refreshing={hostels.loading} onRefresh={() => { hostels.refresh(); bookings.refresh(); }}>
      <Header title="My hostel" />
      <QueryView q={bookings} skeleton={null}>
        {(list) => list.length ? (
          <View style={{ gap: space.sm }}>
            <Text variant="heading">Booking requests</Text>
            {list.map((b) => (
              <DecisionCard key={b.id} approveLabel="Accept" rejectLabel="Decline" onApprove={() => respond(b.id, true)} onReject={(note) => respond(b.id, false, note)}>
                <Text variant="label">{b.student.firstName} {b.student.lastName}, {b.roomType.name}</Text>
                <Text variant="small" tone="muted">{b.roomType.hostel.name}. {b.roomType.availableBeds} beds free.{b.student.phone ? ` Phone ${b.student.phone}.` : ''}</Text>
                {b.message ? <Text variant="small">“{b.message}”</Text> : null}
              </DecisionCard>
            ))}
          </View>
        ) : null}
      </QueryView>
      <QueryView q={hostels} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No hostels yet" why="Add your hostel on the website; the Hostels Office verifies it before students can see it." /> : <>{list.map((h) => (
          <Card key={h.id}>
            <Text variant="heading">{h.name}</Text>
            {h.verification ? <Badge label={VERIFY[h.verification][0]} tone={VERIFY[h.verification][1]} /> : null}
            {h.verificationNote ? <Text variant="small" tone="muted">{h.verificationNote}</Text> : null}
            {h.roomTypes.map((r) => <RoomTypeRow key={r.id} hostelId={h.id} r={r} onSaved={hostels.refresh} />)}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
