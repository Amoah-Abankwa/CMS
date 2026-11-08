import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import { accommodationApi, type MyAccommodation } from '@/api/accommodation';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** Applying for a hall: up to three halls in order, any special needs, and an optional roommate. */
export function ApplyForm({ d, onDone }: { d: MyAccommodation; onDone: () => void }) {
  const { space } = useTheme();
  const draft = useDraft(`hall.apply.${d.semester.id}`, { order: [] as string[], acceptAny: true, specialNeeds: '', roommate: '' });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const toggle = (id: string) => draft.set('order', v.order.includes(id) ? v.order.filter((x) => x !== id) : v.order.length < 3 ? [...v.order, id] : v.order);
  const roommateError = v.roommate.trim() && !/^[A-Za-z]{2,6}\d{6,9}$/.test(v.roommate.trim()) ? 'Use their index number, e.g. ANU25400012.' : null;
  if (sent) return <SuccessState title="Application sent" reassurance="Your choices are in the queue for this semester." next="Rooms are allocated after applications close. You will get a notification with your offer." action={{ label: 'Done', onPress: onDone }} />;
  return (
    <Card>
      <Text variant="heading">Apply for a hall</Text>
      <Text variant="small" tone="muted">Tap up to three halls in the order you prefer them.</Text>
      <FormError error={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {d.hostels.map((h) => <Chip key={h.id} label={`${v.order.includes(h.id) ? `${v.order.indexOf(h.id) + 1}. ` : ''}${h.name}${h.roomTypes[0] ? ` (from ${formatCedis(Math.min(...h.roomTypes.map((r) => r.pricePerSemester)))})` : ''}`} selected={v.order.includes(h.id)} onPress={() => toggle(h.id)} />)}
      </View>
      {touched && !v.order.length ? <Text variant="small" tone="danger">Choose at least one hall.</Text> : null}
      <Chip label={v.acceptAny ? 'Any hall is fine if these are full' : 'Only the halls I chose'} selected={v.acceptAny} onPress={() => draft.set('acceptAny', !v.acceptAny)} />
      <TextField label="Special needs (optional)" value={v.specialNeeds} onChangeText={(x) => draft.set('specialNeeds', x)} hint="For example a ground-floor room. The Hostels Office checks it with you." />
      <TextField label="Roommate's index number (optional)" value={v.roommate} autoCapitalize="characters" onChangeText={(x) => draft.set('roommate', x)} hint="You are put together only if they name you too." error={touched ? roommateError : null} />
      <Button label="Send application" loading={busy} onPress={() => {
        setTouched(true);
        if (!v.order.length || roommateError) return;
        void run(async () => {
          await accommodationApi.apply({ preferences: v.order.map((hostelId) => ({ hostelId, roomType: null })), acceptAny: v.acceptAny, specialNeeds: v.specialNeeds.trim() || undefined, roommateIndex: v.roommate.trim().toUpperCase() || null });
          draft.clear(); setSent(true);
        });
      }} />
    </Card>
  );
}
