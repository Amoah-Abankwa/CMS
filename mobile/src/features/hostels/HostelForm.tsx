import { useState } from 'react';
import { View } from 'react-native';
import { accommodationApi, type HostelGender, type UniversityHostel } from '@/api/accommodation';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const GENDER: Record<HostelGender, string> = { FEMALE: 'Women', MALE: 'Men', MIXED: 'Mixed' };

export function HostelForm({ h, onDone }: { h: UniversityHostel | null; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ name: h?.name ?? '', gender: (h?.gender ?? 'MIXED') as HostelGender, location: h?.location ?? '', contactPhone: h?.contactPhone ?? '', facilities: (h?.facilities ?? []).join(', '), isActive: h?.isActive ?? true });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { name: f.name.trim().length >= 3 ? null : 'Name the hostel.', phone: !f.contactPhone || /^(\+?233|0)\d{9}$/.test(f.contactPhone.replace(/\s/g, '')) ? null : 'A Ghana number.' };
  return (
    <Card>
      <Text variant="heading">{h ? `Edit ${h.name}` : 'Add a university hostel'}</Text>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>{(Object.keys(GENDER) as HostelGender[]).map((g) => <Chip key={g} label={GENDER[g]} selected={f.gender === g} onPress={() => setF({ ...f, gender: g })} />)}</View>
      <TextField label="Location (optional)" value={f.location} onChangeText={(x) => setF({ ...f, location: x })} />
      <TextField label="Porter's phone (optional)" value={f.contactPhone} keyboardType="phone-pad" onChangeText={(x) => setF({ ...f, contactPhone: x })} error={touched ? errs.phone : null} />
      <TextField label="Facilities (separate with commas)" value={f.facilities} onChangeText={(x) => setF({ ...f, facilities: x })} placeholder="Wi-Fi, study room, kitchen" />
      <Chip label={f.isActive ? 'Taking students' : 'Closed'} selected={f.isActive} onPress={() => setF({ ...f, isActive: !f.isActive })} />
      <Button label="Save" loading={busy} onPress={() => { setTouched(true); if (!errs.name && !errs.phone) void run(async () => { await accommodationApi.saveHostel({ name: f.name.trim(), gender: f.gender, location: f.location.trim() || undefined, contactPhone: f.contactPhone.replace(/\s/g, '') || undefined, facilities: f.facilities.split(',').map((x) => x.trim()).filter(Boolean), isActive: f.isActive }, h?.id); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
