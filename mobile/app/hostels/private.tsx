import { useState } from 'react';
import { View } from 'react-native';
import { accommodationApi, type PrivateHostel } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { validate } from '@/lib/validate';
import { useTheme } from '@/theme/useTheme';

type Owner = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string; ownedHostels: Array<{ id: string; name: string; verification: string }> };

export default function PrivateHostels() {
  const { space } = useTheme();
  const [tab, setTab] = useState<'hostels' | 'owners'>('hostels');
  return (
    <Screen>
      <Header title="Private hostels" subtitle="Students only see private hostels the office has verified." />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Hostels" selected={tab === 'hostels'} onPress={() => setTab('hostels')} />
        <Chip label="Owners" selected={tab === 'owners'} onPress={() => setTab('owners')} />
      </View>
      {tab === 'hostels' ? <Hostels /> : <Owners />}
    </Screen>
  );
}

function Hostels() {
  const q = useQuery<PrivateHostel[]>('hostels.private', '/hostels/private');
  const verify = async (id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED', note?: string) => { await accommodationApi.verify(id, status, note); q.refresh(); };
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
      {(list) => list.length === 0 ? <EmptyState title="No private hostels" why="Owners add their hostels; they appear here for verification." /> : <>{list.map((h) => {
        const body = (
          <>
            <Text variant="heading">{h.name}</Text>
            <Text variant="small" tone="muted">{[h.location, h.distanceNote].filter(Boolean).join('. ')}. {h.roomTypes.length} room types.</Text>
            {h.verificationNote ? <Text variant="small">{h.verificationNote}</Text> : null}
          </>
        );
        if (h.verification === 'PENDING') return <DecisionCard key={h.id} approveLabel="Verify" rejectLabel="Reject" onApprove={() => verify(h.id, 'APPROVED')} onReject={(note) => verify(h.id, 'REJECTED', note)}>{body}</DecisionCard>;
        if (h.verification === 'APPROVED') return <DecisionCard key={h.id} approveLabel="Re-verify" rejectLabel="Suspend" onApprove={() => verify(h.id, 'APPROVED')} onReject={(note) => verify(h.id, 'SUSPENDED', note)}>{body}<Badge label="Verified" tone="success" /></DecisionCard>;
        return <Card key={h.id}>{body}<Badge label={h.verification === 'SUSPENDED' ? 'Suspended' : 'Rejected'} tone="danger" /><Button label="Verify now" variant="secondary" onPress={() => void verify(h.id, 'APPROVED')} /></Card>;
      })}</>}
    </QueryView>
  );
}

function Owners() {
  const q = useQuery<Owner[]>('hostels.owners', '/hostels/owners');
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { firstName: f.firstName.trim() ? null : 'First name.', lastName: f.lastName.trim() ? null : 'Surname.', email: validate.email(f.email), phone: /^(\+?233|0)\d{9}$/.test(f.phone.replace(/\s/g, '')) ? null : 'A Ghana number.' };
  return (
    <>
      {done ? <SuccessState title="Owner added" reassurance="They get an email to set up their account." next="They then add their hostel, which you verify here." action={{ label: 'Add another', onPress: () => setDone(false) }} /> : (
        <Card>
          <Text variant="heading">Add a hostel owner</Text>
          <FormError error={error} />
          <TextField label="First name" value={f.firstName} onChangeText={(x) => setF({ ...f, firstName: x })} error={touched ? errs.firstName : null} />
          <TextField label="Surname" value={f.lastName} onChangeText={(x) => setF({ ...f, lastName: x })} error={touched ? errs.lastName : null} />
          <TextField label="Email" value={f.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(x) => setF({ ...f, email: x })} error={touched ? errs.email : null} />
          <TextField label="Phone" value={f.phone} keyboardType="phone-pad" onChangeText={(x) => setF({ ...f, phone: x })} error={touched ? errs.phone : null} />
          <Button label="Add owner" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await accommodationApi.createOwner({ firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.replace(/\s/g, '') }); setF({ firstName: '', lastName: '', email: '', phone: '' }); setTouched(false); setDone(true); q.refresh(); }); }} />
        </Card>
      )}
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No owners yet" why="Add owners above." /> : <>{list.map((o) => (
          <Card key={o.id} style={{ padding: 10 }}>
            <Text variant="label">{o.firstName} {o.lastName}</Text>
            <Text variant="small" tone="muted">{o.email}{o.phone ? `, ${o.phone}` : ''}. {o.ownedHostels.map((h) => `${h.name} (${h.verification.toLowerCase()})`).join(', ') || 'No hostel yet'}.</Text>
          </Card>
        ))}</>}
      </QueryView>
    </>
  );
}
