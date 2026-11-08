import { useState } from 'react';
import { View } from 'react-native';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** Checking in with the code shown in the room (a class or morning devotion). */
export function CodeCheckIn({ title, hint, submit, onDone }: { title: string; hint: string; submit: (code: string) => Promise<{ headline: string; detail: string }>; onDone: () => void }) {
  const { space } = useTheme();
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<{ headline: string; detail: string } | null>(null);
  const { busy, error, run } = useSubmit();
  const problem = touched && code.trim().length < 4 ? 'Enter the code exactly as shown on the screen in the room (at least 4 characters).' : null;
  if (done) return <SuccessState title={done.headline} reassurance={done.detail} next="Nothing else to do: your record updates straight away." action={{ label: 'Done', onPress: () => { setDone(null); setCode(''); setTouched(false); onDone(); } }} />;
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <FormError error={error} />
      <TextField label="Code" value={code} autoCapitalize="characters" autoCorrect={false} maxLength={12} onChangeText={(v) => setCode(v.toUpperCase().replace(/\s/g, ''))} onBlur={() => setTouched(true)} hint={hint} error={problem ?? error?.fields.code} />
      <View style={{ marginTop: space.xs }}>
        <Button label="Check in" loading={busy} onPress={() => { setTouched(true); if (code.trim().length >= 4) void run(async () => setDone(await submit(code.trim()))); }} />
      </View>
    </Card>
  );
}
