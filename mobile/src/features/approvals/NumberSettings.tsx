import { useState } from 'react';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';

export interface NumberField { key: string; label: string; min: number; max: number; hint?: string }

/** A small settings form of whole numbers, each checked against its range inline. */
export function NumberSettings({ fields, initial, onSave, savedText }: { fields: NumberField[]; initial: Record<string, number>; onSave: (v: Record<string, number>) => Promise<void>; savedText: string }) {
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, String(initial[f.key] ?? '')])));
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const problem = (f: NumberField) => { const n = Number(v[f.key]); return Number.isInteger(n) && n >= f.min && n <= f.max ? null : `A whole number from ${f.min} to ${f.max}.`; };
  if (saved) return <SuccessState title="Saved" reassurance={savedText} next="It applies from now on." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <FormError error={error} />
      {fields.map((f) => <TextField key={f.key} label={f.label} hint={f.hint} value={v[f.key]} keyboardType="number-pad" onChangeText={(x) => setV({ ...v, [f.key]: x })} error={problem(f)} />)}
      <Button label="Save" disabled={fields.some((f) => problem(f))} loading={busy} onPress={() => void run(async () => { await onSave({ ...initial, ...Object.fromEntries(fields.map((f) => [f.key, Number(v[f.key])])) }); setSaved(true); })} />
    </Card>
  );
}
