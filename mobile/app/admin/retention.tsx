import { useState } from 'react';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { StepUpPrompt } from '@/components/states/StepUpPrompt';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useStepUp } from '@/hooks/useStepUp';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

interface Rules { notificationsDays: number; deliveriesDays: number; abandonedPaymentsDays: number; activityLogYears: number | null }

export default function Retention() {
  const q = useQuery<Rules>('admin.retention', '/security/retention');
  return (
    <Screen>
      <Header title="Records retention" subtitle="How long records are kept before the nightly clean-up removes them. Agree these with your data protection officer." />
      <QueryView q={q} skeleton={<SkeletonCard lines={4} />}>{(r) => <Form r={r} onSaved={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Form({ r, onSaved }: { r: Rules; onSaved: () => void }) {
  const [f, setF] = useState({ notifications: String(r.notificationsDays), deliveries: String(r.deliveriesDays), payments: String(r.abandonedPaymentsDays), forever: r.activityLogYears === null, years: String(r.activityLogYears ?? 7) });
  const [saved, setSaved] = useState(false);
  const step = useStepUp();
  const { busy, error, run } = useSubmit();
  const days = (v: string) => (Number.isInteger(Number(v)) && Number(v) >= 30 && Number(v) <= 3650 ? null : 'From 30 to 3650 days.');
  const yearsError = !f.forever && !(Number.isInteger(Number(f.years)) && Number(f.years) >= 1 && Number(f.years) <= 50) ? 'From 1 to 50 years.' : null;
  const bad = days(f.notifications) || days(f.deliveries) || days(f.payments) || yearsError;
  if (saved) return <SuccessState title="Retention saved" reassurance="The nightly clean-up uses these periods from tonight." next="Records already past the new limit are removed at the next run." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <FormError error={error} />
      {step.asking ? <StepUpPrompt onConfirm={step.confirm} onCancel={step.cancel} /> : null}
      <TextField label="Notifications (days)" value={f.notifications} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, notifications: x })} error={days(f.notifications)} />
      <TextField label="Email and SMS delivery records (days)" value={f.deliveries} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, deliveries: x })} error={days(f.deliveries)} />
      <TextField label="Payments never completed (days)" value={f.payments} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, payments: x })} error={days(f.payments)} />
      <Chip label={f.forever ? 'Activity log kept for ever' : 'Activity log kept for a number of years'} selected={f.forever} onPress={() => setF({ ...f, forever: !f.forever })} />
      {!f.forever ? <TextField label="Activity log (years)" value={f.years} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, years: x })} error={yearsError} /> : null}
      <Button label="Save" disabled={!!bad} loading={busy} onPress={() => void run(() => step.guard(async () => { await axiosInstance.put('/security/retention', { notificationsDays: Number(f.notifications), deliveriesDays: Number(f.deliveries), abandonedPaymentsDays: Number(f.payments), activityLogYears: f.forever ? null : Number(f.years) }); setSaved(true); onSaved(); }))} />
    </Card>
  );
}
