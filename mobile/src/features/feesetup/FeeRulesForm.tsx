import { useState } from 'react';
import type { FeeRules } from '@anu/shared';
import { feesApi } from '@/api/fees';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';

/** The smallest online payment, and late payment charges (off unless Finance turns them on). */
export function FeeRulesForm() {
  const q = useQuery<FeeRules>('fees.rules', '/fees/rules');
  return <QueryView q={q} skeleton={null}>{(r) => <Form r={r} onSaved={q.refresh} />}</QueryView>;
}

function Form({ r, onSaved }: { r: FeeRules; onSaved: () => void }) {
  const [f, setF] = useState({ min: String(r.minOnlinePayment / 100), minUsd: String(r.minOnlinePaymentUsd / 100), late: r.lateFeeEnabled, lateFee: String(r.lateFee / 100), lateUsd: String(r.lateFeeUsd / 100) });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { min: Number(f.min) >= 1 && Number(f.min) <= 5000 ? null : 'From GH₵ 1 to 5,000.', minUsd: Number(f.minUsd) >= 1 && Number(f.minUsd) <= 1000 ? null : 'From US$ 1 to 1,000.', lateFee: !f.late || Number(f.lateFee) > 0 ? null : 'The charge in cedis.', lateUsd: !f.late || Number(f.lateUsd) > 0 ? null : 'The charge in dollars.' };
  return (
    <Card>
      <Text variant="heading">Payment rules</Text>
      <FormError error={error} />
      {saved ? <Notice tone="success">Saved.</Notice> : null}
      <Text variant="small" tone="muted">Exam clearance: {r.clearancePercent}% of the bill paid (set by the Registrar).</Text>
      <TextField label="Smallest online payment (GH₵)" value={f.min} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, min: x })} error={errs.min} />
      <TextField label="Smallest online payment (US$)" value={f.minUsd} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, minUsd: x })} error={errs.minUsd} />
      <Chip label={f.late ? 'Late charges on' : 'Late charges off'} selected={f.late} onPress={() => setF({ ...f, late: !f.late })} />
      {f.late ? <TextField label="Charge per missed instalment (GH₵)" value={f.lateFee} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, lateFee: x })} error={errs.lateFee} /> : null}
      {f.late ? <TextField label="Charge per missed instalment (US$)" value={f.lateUsd} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, lateUsd: x })} error={errs.lateUsd} /> : null}
      <Button label="Save rules" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await feesApi.saveRules({ minOnlinePayment: Math.round(Number(f.min) * 100), minOnlinePaymentUsd: Math.round(Number(f.minUsd) * 100), lateFeeEnabled: f.late, lateFee: Math.round(Number(f.lateFee) * 100), lateFeeUsd: Math.round(Number(f.lateUsd) * 100) }); setSaved(true); onSaved(); })} />
    </Card>
  );
}
