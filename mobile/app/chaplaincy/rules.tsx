import { useState } from 'react';
import { View } from 'react-native';
import type { DevotionPolicy } from '@anu/shared';
import { devotionApi } from '@/api/devotion';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { DAYS } from '@/lib/hours';
import { useTheme } from '@/theme/useTheme';

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export default function DevotionRules() {
  const q = useQuery<DevotionPolicy>('chapel.policy', '/devotion/policy');
  return (
    <Screen>
      <Header title="Devotion rules" />
      <QueryView q={q} skeleton={<SkeletonCard lines={6} />}>{(p) => <Rules p={p} onSaved={q.refresh} />}</QueryView>
    </Screen>
  );
}

function Rules({ p, onSaved }: { p: DevotionPolicy; onSaved: () => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ ...p, totalMarks: String(p.totalMarks), lateCredit: String(p.lateCredit) });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const order = isTime(f.opensAt) && isTime(f.startsAt) && isTime(f.lateFrom) && isTime(f.endsAt) && f.opensAt < f.startsAt && f.startsAt <= f.lateFrom && f.lateFrom < f.endsAt;
  const errs = { times: order ? null : 'Times as HH:MM, in order: opens, starts, late from, ends.', days: f.days.length ? null : 'Choose at least one day.', marks: Number(f.totalMarks) > 0 ? null : 'Total marks above 0.', credit: Number(f.lateCredit) >= 0 && Number(f.lateCredit) < 1 ? null : 'Late credit from 0 to just under 1 (0.5 is half marks).' };
  if (saved) return <SuccessState title="Rules saved" reassurance="New services follow these times." next="Services already held keep their records." action={{ label: 'Done', onPress: () => setSaved(false) }} />;
  return (
    <Card>
      <FormError error={error} />
      <Text variant="label">Days</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{DAYS.map((d, i) => <Chip key={d} label={d.slice(0, 3)} selected={f.days.includes(i)} onPress={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })} />)}</View>
      {errs.days ? <Text variant="small" tone="danger">{errs.days}</Text> : null}
      <TextField label="Check-in opens" value={f.opensAt} onChangeText={(x) => setF({ ...f, opensAt: x })} />
      <TextField label="Service starts (before this is on time)" value={f.startsAt} onChangeText={(x) => setF({ ...f, startsAt: x })} />
      <TextField label="Late from" value={f.lateFrom} onChangeText={(x) => setF({ ...f, lateFrom: x })} />
      <TextField label="Ends (after this is absent)" value={f.endsAt} onChangeText={(x) => setF({ ...f, endsAt: x })} error={errs.times} />
      <TextField label="Semester total marks" value={f.totalMarks} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, totalMarks: x })} error={errs.marks} />
      <TextField label="Share of marks for arriving late" value={f.lateCredit} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, lateCredit: x })} error={errs.credit} />
      <Button label="Save rules" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await devotionApi.setPolicy({ ...p, ...f, totalMarks: Number(f.totalMarks), lateCredit: Number(f.lateCredit) }); setSaved(true); onSaved(); })} />
    </Card>
  );
}
