import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { validate } from '@/lib/validate';
import { useTheme } from '@/theme/useTheme';
import { authApi, type StaffStep } from './api';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';

/** Email and password; the next step (authenticator code, or setting one up) comes back from the server. */
export function StaffForm({ onNext }: { onNext: (step: StaffStep) => void }) {
  const { space } = useTheme();
  const draft = useDraft('sign-in.staff', { email: '' });
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const { busy, error, run } = useSubmit();
  const emailError = touched.email ? validate.email(draft.value.email) : null;
  const pwError = touched.password ? validate.password(password) : null;
  const submit = () => {
    setTouched({ email: true, password: true });
    if (validate.email(draft.value.email) || validate.password(password)) return;
    void run(async () => onNext(await authApi.staff(draft.value.email, password)));
  };
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      <TextField label="Email" value={draft.value.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@anu.edu.gh" onChangeText={(v) => draft.set('email', v)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} error={emailError ?? error?.fields.email} />
      <TextField label="Password" value={password} secureTextEntry autoComplete="password" onChangeText={setPassword} onBlur={() => setTouched((t) => ({ ...t, password: true }))} error={pwError ?? error?.fields.password} onSubmitEditing={submit} />
      <Button label="Continue" loading={busy} onPress={submit} />
    </View>
  );
}
