import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/**
 * Something waiting for a decision: approve, or say no with a note the person will read. The note is
 * required for "no", and is checked inline.
 */
export function DecisionCard({ children, approveLabel = 'Approve', rejectLabel = 'Return with a note', onApprove, onReject }: { children: ReactNode; approveLabel?: string; rejectLabel?: string; onApprove: () => Promise<void>; onReject: (note: string) => Promise<void> }) {
  const { space } = useTheme();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const noteError = touched && note.trim().length < 5 ? 'Tell them what to change (at least 5 characters). They see this note.' : null;
  return (
    <Card>
      {children}
      <FormError error={error} />
      {rejecting ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Note to the student" value={note} onChangeText={setNote} onBlur={() => setTouched(true)} multiline error={noteError} />
          <Button label={rejectLabel} variant="danger" loading={busy} onPress={() => { setTouched(true); if (note.trim().length >= 5) void run(() => onReject(note.trim())); }} />
          <Button label="Cancel" variant="ghost" onPress={() => { setRejecting(false); setTouched(false); }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label={approveLabel} loading={busy} onPress={() => void run(onApprove)} /></View>
          <View style={{ flex: 1 }}><Button label="Say no" variant="secondary" onPress={() => setRejecting(true)} /></View>
        </View>
      )}
    </Card>
  );
}
