import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatMoney, STUDENT_GROUP_LABEL, type FeeStudentGroup } from '@anu/shared';
import { feesApi, type FeeItem, type FeeOptions, type Schedule } from '@/api/fees';
import { FormError } from '@/components/states/FormError';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

/** Who pays what: a schedule's students (group, currency, programme, level) and its lines from the fee items. */
export function ScheduleForm({ semesterId, s, items, options, onDone }: { semesterId: string; s: Schedule | null; items: FeeItem[]; options: FeeOptions; onDone: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ name: s?.name ?? '', group: (s?.studentGroup ?? 'ALL') as FeeStudentGroup, currency: (s?.currency ?? 'GHS') as 'GHS' | 'USD', programmeId: s?.programmeId ?? null as string | null, level: s?.level ? String(s.level) : '' });
  const [lines, setLines] = useState<Record<string, string>>(Object.fromEntries((s?.lines ?? []).filter((l) => l.feeItemId).map((l) => [l.feeItemId!, String(l.amount / 100)])));
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const used = Object.entries(lines).filter(([, v]) => v.trim());
  const total = used.reduce((t, [, v]) => t + Math.round(Number(v) * 100), 0);
  const errs = { name: f.name.trim().length >= 3 ? null : 'Name it, e.g. "Undergraduate fees (Ghanaian students)".', level: !f.level || [100, 200, 300, 400, 500, 600].includes(Number(f.level)) ? null : 'A level like 100, or empty for every level.', lines: used.length ? (used.some(([, v]) => !(Number(v) > 0)) ? 'Every amount must be above 0.' : null) : 'Add at least one fee item with its amount.' };
  return (
    <Card>
      <Text variant="heading">{s ? 'Edit schedule' : 'New fee schedule'}</Text>
      <FormError error={error} />
      <TextField label="Name" value={f.name} onChangeText={(x) => setF({ ...f, name: x })} error={touched ? errs.name : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(STUDENT_GROUP_LABEL) as FeeStudentGroup[]).map((g) => <Chip key={g} label={STUDENT_GROUP_LABEL[g]} selected={f.group === g} onPress={() => setF({ ...f, group: g })} />)}</View>
      <View style={{ flexDirection: 'row', gap: space.sm }}><Chip label="In cedis" selected={f.currency === 'GHS'} onPress={() => setF({ ...f, currency: 'GHS' })} /><Chip label="In dollars" selected={f.currency === 'USD'} onPress={() => setF({ ...f, currency: 'USD' })} /></View>
      <Text variant="label">Programme (optional: empty means every programme)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label="Every programme" selected={!f.programmeId} onPress={() => setF({ ...f, programmeId: null })} />
        {options.programmes.map((p) => <Chip key={p.id} label={p.name} selected={f.programmeId === p.id} onPress={() => setF({ ...f, programmeId: p.id })} />)}
      </ScrollView>
      <TextField label="Level (optional)" value={f.level} keyboardType="number-pad" placeholder="Every level" onChangeText={(x) => setF({ ...f, level: x })} error={touched ? errs.level : null} hint="A schedule for one level (e.g. 100 with matriculation) wins over a general one." />
      <Text variant="label">What students pay</Text>
      {items.filter((i) => i.isActive || lines[i.id]).map((i) => <TextField key={i.id} label={`${i.name} (${f.currency === 'USD' ? 'US$' : 'GH₵'})`} value={lines[i.id] ?? ''} keyboardType="decimal-pad" placeholder="Not charged" onChangeText={(x) => setLines({ ...lines, [i.id]: x.replace(',', '.') })} />)}
      {touched && errs.lines ? <Text variant="small" tone="danger">{errs.lines}</Text> : null}
      <Text variant="label">Total {formatMoney(total, f.currency)}</Text>
      <Button label="Save schedule" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await feesApi.saveSchedule({ semesterId, name: f.name.trim(), programmeId: f.programmeId, level: f.level ? Number(f.level) : null, studentGroup: f.group, currency: f.currency, lines: used.map(([feeItemId, v]) => ({ feeItemId, amount: Math.round(Number(v) * 100) })) }, s?.id); onDone(); }); }} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
