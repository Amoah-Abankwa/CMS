import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { staffApi, type AssignableRole, type RoleChoice, type SchoolNode } from '@/api/staff';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { RolePicker } from '@/features/registry/RolePicker';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { validate } from '@/lib/validate';
import { useTheme } from '@/theme/useTheme';

export default function AddStaff() {
  const { space } = useTheme();
  const roles = useQuery<AssignableRole[]>('staff.roles', '/staff/assignable-roles');
  const structure = useQuery<SchoolNode[]>('staff.structure', '/academics/structure');
  const draft = useDraft('staff.new', { title: '', firstName: '', lastName: '', email: '', phone: '', staffNumber: '', departmentId: '', isTeaching: false });
  const [sel, setSel] = useState<{ roles: RoleChoice[]; primary: string }>({ roles: [], primary: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const errs = { firstName: v.firstName.trim() ? null : 'Enter the first name.', lastName: v.lastName.trim() ? null : 'Enter the surname.', email: validate.email(v.email), staffNumber: v.staffNumber.trim().length >= 2 ? null : 'Enter the staff number from HR.', roles: sel.roles.length ? null : 'Give them at least one role.' };
  const e = (k: keyof typeof errs) => (touched ? errs[k] ?? error?.fields[k] : null);
  if (done) return <Screen><SuccessState title={`${done} is added`} reassurance="Their account is ready." next="They get an email with a link to set their password and authenticator." action={{ label: 'Back to staff', onPress: () => router.replace('/staff' as never) }} /></Screen>;
  return (
    <Screen>
      <Header title="Add staff member" />
      <Card>
        <FormError error={error} />
        <TextField label="Title (optional)" value={v.title} placeholder="Dr, Prof, Mr, Mrs" onChangeText={(x) => draft.set('title', x)} />
        <TextField label="First name" value={v.firstName} onChangeText={(x) => draft.set('firstName', x)} error={e('firstName')} />
        <TextField label="Surname" value={v.lastName} onChangeText={(x) => draft.set('lastName', x)} error={e('lastName')} />
        <TextField label="Email" value={v.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(x) => draft.set('email', x)} error={e('email')} />
        <TextField label="Phone (optional)" value={v.phone} keyboardType="phone-pad" onChangeText={(x) => draft.set('phone', x)} />
        <TextField label="Staff number" value={v.staffNumber} autoCapitalize="characters" onChangeText={(x) => draft.set('staffNumber', x)} error={e('staffNumber')} />
        <Text variant="label">Department (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{(structure.data ?? []).flatMap((s) => s.departments).map((d) => <Chip key={d.id} label={d.name} selected={v.departmentId === d.id} onPress={() => draft.set('departmentId', v.departmentId === d.id ? '' : d.id)} />)}</ScrollView>
        <Chip label={v.isTeaching ? 'Teaches' : 'Does not teach'} selected={v.isTeaching} onPress={() => draft.set('isTeaching', !v.isTeaching)} />
      </Card>
      <Card>
        <Text variant="heading">Roles</Text>
        <RolePicker roles={roles.data ?? []} structure={structure.data ?? []} value={sel.roles} primary={sel.primary} onChange={(r, p) => setSel({ roles: r, primary: p })} />
        {e('roles') ? <Text variant="small" tone="danger">{e('roles')}</Text> : null}
      </Card>
      <Button label="Add staff member" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { const r = await staffApi.create({ title: v.title.trim() || undefined, firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim().toLowerCase(), phone: v.phone.replace(/\s/g, '') || undefined, staffNumber: v.staffNumber.trim(), departmentId: v.departmentId || undefined, isTeaching: v.isTeaching, roles: sel.roles, primaryRoleKey: sel.primary }); draft.clear(); setDone(`${r.firstName} ${r.lastName}`); }); }} />
    </Screen>
  );
}
