import { useState } from 'react';
import type { EmploymentRules } from '@anu/shared';
import { workApi } from '@/api/employment';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

export default function EmploymentRulesScreen() {
  const q = useQuery<EmploymentRules>('emp.rules', '/employment/rules');
  return (
    <Screen>
      <Header title="Employment rules" />
      <QueryView q={q} skeleton={<SkeletonCard lines={6} />}>{(r) => <Form r={r} onSaved={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Form({ r, onSaved }: { r: EmploymentRules; onSaved: () => void }) {
  const [f, setF] = useState({ minCgpa: String(r.minCgpa), allowNoResults: r.allowNoResults, maxJobs: String(r.maxJobs), fee: String(r.dispatchFee / 100), maxActive: String(r.maxActiveDeliveries), wait: String(r.dispatchWaitMinutes) });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { cgpa: Number(f.minCgpa) >= 0 && Number(f.minCgpa) <= 4 ? null : 'From 0 to 4.', jobs: Number.isInteger(Number(f.maxJobs)) && Number(f.maxJobs) >= 1 && Number(f.maxJobs) <= 5 ? null : 'From 1 to 5.', fee: Number(f.fee) >= 0 ? null : 'In cedis.', active: Number.isInteger(Number(f.maxActive)) && Number(f.maxActive) >= 1 && Number(f.maxActive) <= 5 ? null : 'From 1 to 5.', wait: Number.isInteger(Number(f.wait)) && Number(f.wait) >= 1 && Number(f.wait) <= 120 ? null : 'From 1 to 120 minutes.' };
  if (saved) return <SuccessState title="Rules saved" reassurance="New applications and deliveries follow them." next="Students already working keep their jobs." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Minimum CGPA to work" value={f.minCgpa} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, minCgpa: x })} error={errs.cgpa} />
      <Chip label={f.allowNoResults ? 'First-years without results may apply' : 'Results needed before working'} selected={f.allowNoResults} onPress={() => setF({ ...f, allowNoResults: !f.allowNoResults })} />
      <TextField label="Campus jobs a student may hold at once" value={f.maxJobs} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, maxJobs: x })} error={errs.jobs} />
      <TextField label="Dispatcher's fee per delivery (GH₵)" value={f.fee} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, fee: x })} error={errs.fee} />
      <TextField label="Deliveries a dispatcher may carry at once" value={f.maxActive} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, maxActive: x })} error={errs.active} />
      <TextField label="Alert the vendor if nobody takes an order within (minutes)" value={f.wait} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, wait: x })} error={errs.wait} />
      <Button label="Save" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await workApi.saveRules({ minCgpa: Number(f.minCgpa), allowNoResults: f.allowNoResults, maxJobs: Number(f.maxJobs), dispatchFee: Math.round(Number(f.fee) * 100), maxActiveDeliveries: Number(f.maxActive), dispatchWaitMinutes: Number(f.wait) }); setSaved(true); onSaved(); })} />
    </Card>
  );
}
