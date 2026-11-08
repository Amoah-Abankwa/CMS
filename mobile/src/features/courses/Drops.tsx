import { useState } from 'react';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

export interface Drop { id: string; reason: string; status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'; decisionNote: string | null; offering: { id: string; course: { code: string; title: string } } }
const STATUS = { REQUESTED: ['Drop requested', 'warning'], APPROVED: ['Dropped', 'success'], REJECTED: ['Not approved', 'danger'], WITHDRAWN: ['Withdrawn', 'neutral'] } as const;

/** Asking to drop one of this term's courses: a reason, then the approver decides. */
export function DropForm({ offeringId, course, onDone, onCancel }: { offeringId: string; course: string; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  if (sent) return <SuccessState title="Request sent" reassurance={`Your request to drop ${course} went for approval. You stay registered until it is decided.`} next="You will get a notification with the decision." action={{ label: 'Done', onPress: onDone }} />;
  const problem = touched && reason.trim().length < 5 ? 'Say why you want to drop it (at least 5 characters).' : null;
  return (
    <Card>
      <Text variant="heading">Drop {course}?</Text>
      <FormError error={error} />
      <TextField label="Reason" value={reason} onChangeText={setReason} onBlur={() => setTouched(true)} multiline error={problem ?? error?.fields.reason} />
      <Button label="Send request" loading={busy} onPress={() => { setTouched(true); if (reason.trim().length >= 5) void run(async () => { await axiosInstance.post('/me/drops', { offeringId, reason: reason.trim() }); setSent(true); }); }} />
      <Button label="Keep the course" variant="ghost" onPress={onCancel} />
    </Card>
  );
}

export function DropList({ drops, onChange }: { drops: Drop[]; onChange: () => void }) {
  const { busy, error, run } = useSubmit();
  if (!drops.length) return null;
  return (
    <Card>
      <Text variant="heading">Drop requests</Text>
      <FormError error={error} />
      {drops.map((d) => (
        <Card key={d.id} style={{ padding: 10 }}>
          <Text variant="label">{d.offering.course.code} {d.offering.course.title}</Text>
          <Badge label={STATUS[d.status][0]} tone={STATUS[d.status][1]} />
          {d.decisionNote ? <Text variant="small" tone="muted">{d.decisionNote}</Text> : null}
          {d.status === 'REQUESTED' ? <Button label="Withdraw request" variant="ghost" loading={busy} onPress={() => void run(async () => { await axiosInstance.post(`/me/drops/${d.id}/withdraw`); onChange(); })} /> : null}
        </Card>
      ))}
    </Card>
  );
}
