import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { FormError } from './FormError';
import { useSubmit } from '@/hooks/useSubmit';
import { validate } from '@/lib/validate';

/** Asks for an authenticator code before a sensitive action goes ahead. */
export function StepUpPrompt({ onConfirm, onCancel }: { onConfirm: (code: string) => Promise<void>; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const { busy, error, run } = useSubmit();
  return (
    <Card>
      <Text variant="heading">Confirm it is you</Text>
      <Text tone="muted">This change needs a code from your authenticator app.</Text>
      <FormError error={error} />
      <TextField label="Authenticator code" value={code} keyboardType="number-pad" maxLength={6} onChangeText={(x) => setCode(x.replace(/\D/g, ''))} error={code ? validate.code(code) : null} />
      <Button label="Confirm and continue" disabled={!!validate.code(code)} loading={busy} onPress={() => void run(() => onConfirm(code))} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  );
}
