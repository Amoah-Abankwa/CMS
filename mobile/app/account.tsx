import { useState } from 'react';
import { View } from 'react-native';
import { authApi, type ActiveSession } from '@/api/auth';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const rule = (v: string) => (v.length < 10 ? 'Use at least 10 characters. A few words together works well, e.g. "mango river blue 7".' : null);

export default function Account() {
  const q = useQuery<ActiveSession[]>('me.sessions', '/auth/sessions');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Account and security" />
      <ChangePassword />
      <Text variant="heading">Where you are signed in</Text>
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(d) => <Sessions list={d} onChange={q.refresh} />}
      </QueryView>
    </Screen>
  );
}

function ChangePassword() {
  const { space } = useTheme();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { current: touched && !f.current ? 'Enter the password you use now.' : null, next: touched ? rule(f.next) : null, again: touched && f.again !== f.next ? 'This does not match the new password. Type it again.' : null };
  if (done) return <SuccessState title="Password changed" reassurance="Your new password works from now on, on the app and the website." next="Other phones and browsers stay signed in; sign them out below if you do not recognise one." action={{ label: 'Done', onPress: () => setDone(false) }} />;
  return (
    <Card>
      <Text variant="heading">Change password</Text>
      <FormError error={error} />
      <View style={{ gap: space.md }}>
        <TextField label="Current password" secureTextEntry value={f.current} onChangeText={(v) => setF({ ...f, current: v })} error={errs.current ?? error?.fields.currentPassword} />
        <TextField label="New password" secureTextEntry value={f.next} onChangeText={(v) => setF({ ...f, next: v })} hint="At least 10 characters." error={errs.next ?? error?.fields.newPassword} />
        <TextField label="New password again" secureTextEntry value={f.again} onChangeText={(v) => setF({ ...f, again: v })} error={errs.again} />
        <Button label="Change password" loading={busy} onPress={() => {
          setTouched(true);
          if (!f.current || rule(f.next) || f.again !== f.next) return;
          void run(async () => { await authApi.changePassword(f.current, f.next); setF({ current: '', next: '', again: '' }); setTouched(false); setDone(true); });
        }} />
      </View>
    </Card>
  );
}

function Sessions({ list, onChange }: { list: ActiveSession[]; onChange: () => void }) {
  const { busy, error, run } = useSubmit();
  return (
    <>
      <FormError error={error} />
      {list.map((s) => (
        <Card key={s.id}>
          <Text variant="label">{s.current ? 'This phone' : (s.userAgent ?? 'Unknown device').slice(0, 60)}</Text>
          <Text variant="small" tone="muted">Last used {new Date(s.lastSeenAt).toLocaleString()}{s.ipAddress ? `, from ${s.ipAddress}` : ''}</Text>
          {!s.current ? <Button label="Sign out this device" variant="secondary" loading={busy} onPress={() => void run(async () => { await authApi.revokeSession(s.id); onChange(); })} /> : null}
        </Card>
      ))}
    </>
  );
}
