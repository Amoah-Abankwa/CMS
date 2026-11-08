import { useState } from 'react';
import { View } from 'react-native';
import { JOB_KIND_LABEL, type JobKind, type JobPayUnit } from '@anu/shared';
import { FormError } from '@/components/states/FormError';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

const EMPTY = { kind: 'INTERNSHIP' as JobKind, title: '', organisation: '', description: '', hoursPerWeek: '10', payRate: '', payUnit: 'MONTH' as JobPayUnit, positions: '1', closesAt: '' };

/** Posting an opportunity: every field checked inline, kept as a draft until posted. */
export function PostForm({ onPosted }: { onPosted: () => void }) {
  const { space } = useTheme();
  const draft = useDraft('opportunity.new', EMPTY);
  const [touched, setTouched] = useState(false);
  const [posted, setPosted] = useState(false);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const errs = {
    title: v.title.trim().length < 4 ? 'Give a clear title (at least 4 characters).' : null,
    description: v.description.trim().length < 30 ? 'Describe the work in at least 30 characters.' : null,
    hours: !(Number(v.hoursPerWeek) > 0 && Number(v.hoursPerWeek) <= 40) ? 'Hours a week between 1 and 40.' : null,
    positions: !(Number.isInteger(Number(v.positions)) && Number(v.positions) >= 1) ? 'At least 1 place.' : null,
    pay: v.payRate && !(Number(v.payRate) >= 0) ? 'Pay in cedis, e.g. 500 (or leave empty if unpaid).' : null,
    closes: !/^\d{4}-\d{2}-\d{2}$/.test(v.closesAt) || v.closesAt <= new Date().toISOString().slice(0, 10) ? 'A closing date after today, as YYYY-MM-DD.' : null,
  };
  const show = (k: keyof typeof errs) => (touched ? errs[k] : null);
  if (posted) return <SuccessState title="Opportunity posted" reassurance="It is saved and sent to Career Services." next="They check it, then students can see and apply. Applicants appear on this page." action={{ label: 'Post another', onPress: () => setPosted(false) }} />;
  return (
    <Card>
      <Text variant="heading">Post an opportunity</Text>
      <FormError error={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((k) => <Chip key={k} label={JOB_KIND_LABEL[k]} selected={v.kind === k} onPress={() => draft.set('kind', k)} />)}
      </View>
      <TextField label="Title" value={v.title} onChangeText={(x) => draft.set('title', x)} error={show('title') ?? error?.fields.title} />
      <TextField label="Organisation or unit" value={v.organisation} onChangeText={(x) => draft.set('organisation', x)} placeholder="Department of Computer Science" />
      <TextField label="What the work involves" value={v.description} onChangeText={(x) => draft.set('description', x)} multiline style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }} error={show('description') ?? error?.fields.description} />
      <TextField label="Hours a week" value={v.hoursPerWeek} keyboardType="number-pad" onChangeText={(x) => draft.set('hoursPerWeek', x)} error={show('hours')} />
      <TextField label="Pay in cedis (optional)" value={v.payRate} keyboardType="decimal-pad" onChangeText={(x) => draft.set('payRate', x)} error={show('pay')} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(['HOUR', 'MONTH', 'TASK'] as JobPayUnit[]).map((u) => <Chip key={u} label={u === 'HOUR' ? 'An hour' : u === 'MONTH' ? 'A month' : 'A task'} selected={v.payUnit === u} onPress={() => draft.set('payUnit', u)} />)}
      </View>
      <TextField label="Places" value={v.positions} keyboardType="number-pad" onChangeText={(x) => draft.set('positions', x)} error={show('positions')} />
      <TextField label="Applications close" value={v.closesAt} placeholder="YYYY-MM-DD" onChangeText={(x) => draft.set('closesAt', x)} error={show('closes')} />
      <Button label="Post" loading={busy} onPress={() => {
        setTouched(true);
        if (Object.values(errs).some(Boolean)) return;
        void run(async () => {
          await axiosInstance.post('/opportunities', { kind: v.kind, title: v.title.trim(), unit: v.organisation.trim() || 'Department', organisation: v.organisation.trim() || undefined, description: v.description.trim(), hoursPerWeek: Number(v.hoursPerWeek), payRate: Math.round(Number(v.payRate || 0) * 100), payUnit: v.payUnit, positions: Number(v.positions), minCgpa: null, closesAt: `${v.closesAt}T23:59:00.000Z` });
          draft.clear(); setTouched(false); setPosted(true); onPosted();
        });
      }} />
    </Card>
  );
}
