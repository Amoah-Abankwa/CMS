import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { accommodationApi, type MyAccommodation } from '@/api/accommodation';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ApplyForm } from '@/features/accommodation/ApplyForm';
import { PrivateHostels } from '@/features/accommodation/PrivateHostels';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Accommodation() {
  const { space } = useTheme();
  const q = useQuery<MyAccommodation>('me.accommodation', '/me/accommodation');
  const [tab, setTab] = useState<'hall' | 'private' | 'residence'>('hall');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Accommodation" subtitle={q.data?.semester.label} />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Chip label="University halls" selected={tab === 'hall'} onPress={() => setTab('hall')} />
        <Chip label="Private hostels" selected={tab === 'private'} onPress={() => setTab('private')} />
        <Chip label="Where I live" selected={tab === 'residence'} onPress={() => setTab('residence')} />
      </View>
      {tab === 'private' ? <PrivateHostels onBooked={q.refresh} /> : (
        <QueryView q={q} skeleton={<SkeletonCard lines={4} />}>
          {(d) => (tab === 'hall' ? <Halls d={d} refresh={q.refresh} /> : <Residence d={d} refresh={q.refresh} />)}
        </QueryView>
      )}
    </Screen>
  );
}

function Halls({ d, refresh }: { d: MyAccommodation; refresh: () => void }) {
  const { busy, error, run } = useSubmit();
  if (d.allocation) {
    const r = d.allocation.room;
    return (
      <Card>
        <Text variant="heading">{r.hostel.name}, room {r.number}</Text>
        <Text variant="small" tone="muted">{r.roomType}{r.floor ? `, floor ${r.floor}` : ''}. {formatCedis(r.pricePerSemester)} a semester.</Text>
        <FormError error={error} />
        {d.allocation.status === 'ACCEPTED' ? <Badge label="Your room" tone="success" /> : (
          <>
            <Notice tone="warning" title="Room offered to you">{d.allocation.acceptBy ? `Accept by ${day(d.allocation.acceptBy)}, or it goes to the next student.` : 'Accept or decline it.'}</Notice>
            <Button label="Accept the room" loading={busy} onPress={() => void run(async () => { await accommodationApi.respond(true); refresh(); })} />
            <Button label="Decline" variant="ghost" loading={busy} onPress={() => void run(async () => { await accommodationApi.respond(false); refresh(); })} />
          </>
        )}
      </Card>
    );
  }
  if (d.application) {
    return (
      <Card>
        <Text variant="heading">Application sent</Text>
        <Text variant="small" tone="muted">{d.application.preferences.length} hall choices. Waiting for allocation after applications close.</Text>
        <FormError error={error} />
        {d.applicationsOpen ? <Button label="Withdraw application" variant="ghost" loading={busy} onPress={() => void run(async () => { await accommodationApi.withdraw(); refresh(); })} /> : null}
      </Card>
    );
  }
  if (!d.applicationsOpen) return <EmptyState title="Hall applications are closed" why={d.round ? `They ran until ${day(d.round.closesAt)}. Look at private hostels instead.` : 'The Hostels Office has not opened applications for this semester yet.'} />;
  return <ApplyForm d={d} onDone={refresh} />;
}

function Residence({ d, refresh }: { d: MyAccommodation; refresh: () => void }) {
  const draft = useDraft('residence', { address: d.declaration?.address ?? '', digitalAddress: d.declaration?.digitalAddress ?? '', landmark: d.declaration?.landmark ?? '' });
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const gpsError = draft.value.digitalAddress.trim() && !/^[A-Z]{2}-\d{3,4}-\d{4}$/i.test(draft.value.digitalAddress.trim()) ? 'A GhanaPost digital address looks like EN-012-3456.' : null;
  if (saved) return <SuccessState title="Saved" reassurance="The university knows where to reach you this semester." next="Update it here if you move." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <Text variant="heading">Where you live this semester</Text>
      <Text variant="small" tone="muted">{d.residence.label ?? 'Not recorded yet'}</Text>
      <FormError error={error} />
      <TextField label="Address" value={draft.value.address} onChangeText={(v) => draft.set('address', v)} error={touched && draft.value.address.trim().length < 5 ? 'Give the house, street and area (at least 5 characters).' : error?.fields.address} />
      <TextField label="GhanaPost digital address (optional)" value={draft.value.digitalAddress} autoCapitalize="characters" onChangeText={(v) => draft.set('digitalAddress', v)} error={touched ? gpsError : null} />
      <TextField label="Landmark (optional)" value={draft.value.landmark} onChangeText={(v) => draft.set('landmark', v)} />
      <Button label="Save" loading={busy} onPress={() => {
        setTouched(true);
        if (draft.value.address.trim().length < 5 || gpsError) return;
        void run(async () => { await accommodationApi.declare({ address: draft.value.address.trim(), digitalAddress: draft.value.digitalAddress.trim().toUpperCase() || undefined, landmark: draft.value.landmark.trim() || undefined }); draft.clear(); setSaved(true); refresh(); });
      }} />
    </Card>
  );
}
