import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { staffApi, type AssignableRole, type RoleChoice, type SchoolNode, type StaffMember } from '@/api/staff';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { StepUpPrompt } from '@/components/states/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusChange } from '@/components/ui/StatusChange';
import { Text } from '@/components/ui/Text';
import { RolePicker } from '@/features/registry/RolePicker';
import { useQuery } from '@/hooks/useQuery';
import { useStepUp } from '@/hooks/useStepUp';
import { useSubmit } from '@/hooks/useSubmit';

export default function StaffMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<StaffMember>(`staff.member.${id}`, `/staff/${id}`);
  const roles = useQuery<AssignableRole[]>('staff.roles', '/staff/assignable-roles');
  const structure = useQuery<SchoolNode[]>('staff.structure', '/academics/structure');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? [q.data.staffProfile?.title, q.data.firstName, q.data.lastName].filter(Boolean).join(' ') : 'Staff member'} subtitle={q.data?.email ?? undefined} />
      <QueryView q={q} skeleton={<SkeletonCard lines={6} />}>{(m) => <Member m={m} roles={roles.data ?? []} structure={structure.data ?? []} onChange={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Member({ m, roles, structure, onChange }: { m: StaffMember; roles: AssignableRole[]; structure: SchoolNode[]; onChange: () => void }) {
  const [sel, setSel] = useState<{ roles: RoleChoice[]; primary: string }>({ roles: m.roles.map((r) => ({ roleKey: r.key, scopeId: r.scope?.split(':')[1] })), primary: m.primaryRoleKey ?? m.roles[0]?.key ?? '' });
  const [msg, setMsg] = useState<string | null>(null);
  const step = useStepUp();
  const { busy, error, run } = useSubmit();
  return (
    <>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {step.asking ? <StepUpPrompt onConfirm={step.confirm} onCancel={step.cancel} /> : null}
      <Card>
        <Text variant="small" tone="muted">Staff number {m.staffProfile?.staffNumber}. {m.staffProfile?.department?.name ?? 'No department'}. {m.staffProfile?.isTeaching ? 'Teaches.' : ''}</Text>
        <Text variant="small" tone="muted">{m.lastLoginAt ? `Last signed in ${new Date(m.lastLoginAt).toLocaleString()}` : 'Has not signed in yet'}</Text>
        {m.status === 'PENDING_SETUP' ? <Button label="Send the set-up link again" variant="secondary" loading={busy} onPress={() => void run(async () => { await staffApi.resendSetup(m.id); setMsg('Set-up link sent.'); })} /> : null}
        {m.status === 'ACTIVE' ? <Button label="Reset authenticator" variant="secondary" loading={busy} onPress={() => void run(() => step.guard(async () => { await staffApi.resetMfa(m.id); setMsg(`${m.firstName}'s authenticator is reset. They set up a new one at their next sign-in.`); }))} /> : null}
        <StatusChange status={m.status} onChange={(to, reason) => step.guard(async () => { await staffApi.setStatus(m.id, to, reason); onChange(); })} />
      </Card>
      <Card>
        <Text variant="heading">Roles</Text>
        <RolePicker roles={roles} structure={structure} value={sel.roles} primary={sel.primary} onChange={(r, p) => setSel({ roles: r, primary: p })} />
        <Button label="Save roles" disabled={!sel.roles.length || !sel.primary} loading={busy} onPress={() => void run(() => step.guard(async () => { await staffApi.updateRoles(m.id, { roles: sel.roles, primaryRoleKey: sel.primary }); setMsg('Roles saved. They apply at the next sign-in.'); onChange(); }))} />
      </Card>
    </>
  );
}
