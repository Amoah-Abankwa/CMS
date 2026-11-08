import { useState } from 'react';
import { View } from 'react-native';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { TextField } from './TextField';

type Status = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

/** Suspending, deactivating or reactivating an account, always with a reason that is recorded. */
export function StatusChange({ status, onChange }: { status: string; onChange: (to: Status, reason: string) => Promise<void> }) {
  const { space } = useTheme();
  const [to, setTo] = useState<Status | null>(null);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit();
  const options: Array<[Status, string]> = status === 'ACTIVE' ? [['SUSPENDED', 'Suspend'], ['DEACTIVATED', 'Deactivate']] : status === 'PENDING_SETUP' ? [['DEACTIVATED', 'Deactivate']] : [['ACTIVE', 'Reactivate']];
  if (!to) return <View style={{ flexDirection: 'row', gap: space.sm }}>{options.map(([s, l]) => <View key={s} style={{ flex: 1 }}><Button label={l} variant={s === 'ACTIVE' ? 'secondary' : 'ghost'} onPress={() => setTo(s)} /></View>)}</View>;
  return (
    <View style={{ gap: space.sm }}>
      <FormError error={error} />
      <TextField label="Reason (recorded in the activity log)" value={reason} onChangeText={setReason} error={reason && reason.trim().length < 5 ? 'At least 5 characters.' : null} />
      <Button label={to === 'ACTIVE' ? 'Reactivate' : to === 'SUSPENDED' ? 'Suspend the account' : 'Deactivate the account'} variant={to === 'ACTIVE' ? 'primary' : 'danger'} disabled={reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await onChange(to, reason.trim()); setTo(null); setReason(''); })} />
      <Button label="Cancel" variant="ghost" onPress={() => setTo(null)} />
    </View>
  );
}
