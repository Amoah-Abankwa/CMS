import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { SuccessState } from '@/components/states/SuccessState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { validate } from '@/lib/validate';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';
import { authApi } from './api';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';

/**
 * Setting up an authenticator on the same phone: a QR code cannot be scanned here, so offer to open the
 * authenticator app directly, or to type the key. Then confirm with a code and keep the recovery codes.
 */
export function EnrolStep({ challengeToken, replacing }: { challengeToken: string; replacing: boolean }) {
  const { space } = useTheme();
  const [setup, setSetup] = useState<{ otpauthUrl: string; manualKey: string } | null>(null);
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [codes, setCodes] = useState<{ recovery: string[]; tokens: { accessToken: string; refreshToken: string } } | null>(null);
  const { busy, error, run } = useSubmit();
  const completeSignIn = useAuth((s) => s.completeSignIn);
  useEffect(() => { void run(async () => setSetup(await authApi.startEnrol(challengeToken))); }, [challengeToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (codes) {
    return (
      <View style={{ gap: space.md }}>
        <SuccessState title="Your authenticator is set up" reassurance="From now on you sign in with your password and a code from the app." next="Save these recovery codes somewhere safe (not on this phone). Each works once if you ever lose your authenticator." action={{ label: 'I have saved them, continue', onPress: () => void run(() => completeSignIn(codes.tokens)) }} />
        <FormError error={error} />
        <Card>{codes.recovery.map((c) => <Text key={c} style={{ fontFamily: 'monospace' }} selectable>{c}</Text>)}</Card>
      </View>
    );
  }
  if (!setup) return error ? <FormError error={error} /> : <SkeletonCard lines={4} />;
  const submit = () => {
    setTouched(true);
    if (validate.code(code)) return;
    void run(async () => {
      const r = await authApi.confirmEnrol(challengeToken, code);
      setCodes({ recovery: r.recoveryCodes, tokens: { accessToken: r.accessToken, refreshToken: r.refreshToken } });
    });
  };
  return (
    <View style={{ gap: space.md }}>
      <Text tone="muted">{replacing ? 'Your old authenticator has been removed. Set up a new one to finish signing in.' : 'Staff accounts need an authenticator app (such as Google or Microsoft Authenticator).'}</Text>
      <Button label="Open my authenticator app" variant="secondary" onPress={() => void Linking.openURL(setup.otpauthUrl).catch(() => undefined)} />
      <Card>
        <Text variant="small" tone="muted">Or add it by hand with this key:</Text>
        <Text selectable style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{setup.manualKey.replace(/(.{4})/g, '$1 ').trim()}</Text>
      </Card>
      <FormError error={error} />
      <TextField label="Code shown in the app" value={code} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} onBlur={() => setTouched(true)} error={touched ? validate.code(code) : null} onSubmitEditing={submit} />
      <Button label="Finish set-up" loading={busy} onPress={submit} />
    </View>
  );
}
