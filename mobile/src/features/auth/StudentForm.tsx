import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { validate } from '@/lib/validate';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';
import { authApi } from './api';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';

export function StudentForm() {
  const { space } = useTheme();
  const draft = useDraft('sign-in.student', { indexNumber: '' });
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ indexNumber: false, password: false });
  const { busy, error, run } = useSubmit();
  const completeSignIn = useAuth((s) => s.completeSignIn);
  const idError = touched.indexNumber ? validate.indexNumber(draft.value.indexNumber) : null;
  const pwError = touched.password ? validate.password(password) : null;
  const submit = () => {
    setTouched({ indexNumber: true, password: true });
    if (validate.indexNumber(draft.value.indexNumber) || validate.password(password)) return;
    void run(async () => {
      const r = await authApi.student(draft.value.indexNumber, password);
      await completeSignIn(r);
    });
  };
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      <TextField label="Index number" value={draft.value.indexNumber} autoCapitalize="characters" autoCorrect={false} autoComplete="username" placeholder="ANU25400001" onChangeText={(v) => draft.set('indexNumber', v)} onBlur={() => setTouched((t) => ({ ...t, indexNumber: true }))} error={idError ?? error?.fields.indexNumber} />
      <TextField label="Password" value={password} secureTextEntry autoComplete="password" onChangeText={setPassword} onBlur={() => setTouched((t) => ({ ...t, password: true }))} error={pwError ?? error?.fields.password} onSubmitEditing={submit} />
      <Button label="Sign in" loading={busy} onPress={submit} />
    </View>
  );
}
