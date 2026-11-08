import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { studentsApi, type ProgrammeOption, type RegisteredStudent } from '@/api/students';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { validate } from '@/lib/validate';
import { matches } from '@/lib/search';
import { useTheme } from '@/theme/useTheme';

const EMPTY = { firstName: '', middleName: '', lastName: '', email: '', phone: '', programmeId: '', admissionYear: String(new Date().getFullYear()), gender: '' as '' | 'Female' | 'Male', nationality: 'Ghanaian' };

export default function RegisterStudent() {
  const { space } = useTheme();
  const programmes = useQuery<ProgrammeOption[]>('reg.programmes', '/academics/programmes');
  const draft = useDraft('student.new', EMPTY);
  const [find, setFind] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<RegisteredStudent | null>(null);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const errs = {
    firstName: v.firstName.trim() ? null : 'Enter the first name.',
    lastName: v.lastName.trim() ? null : 'Enter the surname.',
    email: validate.email(v.email),
    phone: /^(\+?233|0)\d{9}$/.test(v.phone.replace(/\s/g, '')) ? null : 'A Ghana number, e.g. 024 123 4567.',
    programmeId: v.programmeId ? null : 'Choose the programme.',
    admissionYear: /^20\d{2}$/.test(v.admissionYear) ? null : 'The year of admission, e.g. 2026.',
  };
  const e = (k: keyof typeof errs) => (touched ? errs[k] ?? error?.fields[k] : null);
  if (done) return <Screen><SuccessState title={`${done.firstName} is registered`} reassurance={`Index number ${done.indexNumber}.`} next="They get an email and SMS with a link to set their password." action={{ label: 'Register another student', onPress: () => setDone(null) }} /></Screen>;
  return (
    <Screen>
      <Header title="Register student" subtitle="The index number is given automatically." />
      <Card>
        <FormError error={error} />
        <TextField label="First name" value={v.firstName} onChangeText={(x) => draft.set('firstName', x)} error={e('firstName')} />
        <TextField label="Middle name (optional)" value={v.middleName} onChangeText={(x) => draft.set('middleName', x)} />
        <TextField label="Surname" value={v.lastName} onChangeText={(x) => draft.set('lastName', x)} error={e('lastName')} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Female" selected={v.gender === 'Female'} onPress={() => draft.set('gender', v.gender === 'Female' ? '' : 'Female')} />
          <Chip label="Male" selected={v.gender === 'Male'} onPress={() => draft.set('gender', v.gender === 'Male' ? '' : 'Male')} />
        </View>
        <TextField label="Nationality" value={v.nationality} onChangeText={(x) => draft.set('nationality', x)} />
        <TextField label="Email" value={v.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(x) => draft.set('email', x)} error={e('email')} hint="Sign-in details go here." />
        <TextField label="Phone" value={v.phone} keyboardType="phone-pad" onChangeText={(x) => draft.set('phone', x)} error={e('phone')} />
        <TextField label="Admission year" value={v.admissionYear} keyboardType="number-pad" onChangeText={(x) => draft.set('admissionYear', x)} error={e('admissionYear')} />
      </Card>
      <Card>
        <Text variant="label">Programme</Text>
        <TextField label="Find the programme" value={find} onChangeText={setFind} placeholder="e.g. Computer Science" />
        <QueryView q={programmes} skeleton={<SkeletonCard lines={2} />}>
          {(list) => (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {list.filter((p) => !find.trim() || matches(`${p.name} ${p.code} ${p.department.name}`, find)).slice(0, 20).map((p) => <Chip key={p.id} label={`${p.name} (${p.level.name})`} selected={v.programmeId === p.id} onPress={() => draft.set('programmeId', p.id)} />)}
            </ScrollView>
          )}
        </QueryView>
        {e('programmeId') ? <Text variant="small" tone="danger">{e('programmeId')}</Text> : null}
      </Card>
      <Button label="Register student" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { const r = await studentsApi.register({ firstName: v.firstName.trim(), middleName: v.middleName.trim() || undefined, lastName: v.lastName.trim(), email: v.email.trim().toLowerCase(), phone: v.phone.replace(/\s/g, ''), programmeId: v.programmeId, admissionYear: Number(v.admissionYear), gender: v.gender || undefined, nationality: v.nationality.trim() || undefined }); draft.clear(); setTouched(false); setDone(r); }); }} />
    </Screen>
  );
}
