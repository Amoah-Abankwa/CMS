import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { validate } from '@/lib/validate';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';
import { authApi, type StaffStep } from './api';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';

/**
 * The authenticator code. Can't use the authenticator? An emailed code works instead; then the old
 * authenticator is removed and a new one must be set up (the next step).
 */
export function CodeStep({ challengeToken, onNext, onBack }: { challengeToken: string; onNext: (s: StaffStep) => void; onBack: () => void }) {
  const { space } = useTheme();
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const completeSignIn = useAuth((s) => s.completeSignIn);
  const codeError = touched ? validate.code(code) : null;
  const submit = () => {
    setTouched(true);
    if (validate.code(code)) return;
    void run(async () => {
      if (emailedTo) onNext(await authApi.verifyEmailCode(challengeToken, code));
      else await completeSignIn(await authApi.verify(challengeToken, code));
    });
  };
  return (
    <View style={{ gap: space.md }}>
      <Text tone="muted">{emailedTo ? `We emailed a 6-digit code to ${emailedTo}. It works for 10 minutes. After it, you will set up a new authenticator.` : 'Open your authenticator app and enter the 6-digit code for ANU.'}</Text>
      <FormError error={error} />
      <TextField label={emailedTo ? 'Code from the email' : 'Authenticator code'} value={code} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} onBlur={() => setTouched(true)} error={codeError ?? error?.fields.code} onSubmitEditing={submit} />
      <Button label="Continue" loading={busy} onPress={submit} />
      {!emailedTo ? (
        <Button label="Can't use your authenticator? Email me a code" variant="ghost" onPress={() => void run(async () => { setCode(''); setTouched(false); setEmailedTo((await authApi.sendEmailCode(challengeToken)).sentTo); })} />
      ) : (
        <Button label="Use my authenticator after all" variant="ghost" onPress={() => { setEmailedTo(null); setCode(''); setTouched(false); }} />
      )}
      <Button label="Use a different account" variant="ghost" onPress={onBack} />
    </View>
  );
}
