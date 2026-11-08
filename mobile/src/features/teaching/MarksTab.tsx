import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { resultsApi, type Workbook } from '@/api/results';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';
import { SHEET_STATUS } from './sheetStatus';

/** Marks, one assessment at a time: each score checked against its maximum, kept as a draft until saved. */
export function MarksTab({ offeringId }: { offeringId: string }) {
  const key = `teach.marks.${offeringId}`;
  const q = useQuery<Workbook>(key, `/teaching/classes/${offeringId}/marks`);
  return <QueryView q={q} skeleton={<SkeletonList rows={8} />}>{(w) => <Marks w={w} cacheKey={key} />}</QueryView>;
}

function Marks({ w, cacheKey }: { w: Workbook; cacheKey: string }) {
  const { space } = useTheme();
  const put = useCache((s) => s.put);
  const [aid, setAid] = useState(w.assessments[0]?.id ?? '');
  const a = w.assessments.find((x) => x.id === aid);
  const draft = useDraft<Record<string, string>>(`teach.marks.${w.offering.id}.${aid}`, {});
  const [submitted, setSubmitted] = useState(false);
  const { busy, error, run } = useSubmit();
  if (!w.assessments.length) return <EmptyState title="No assessment scheme yet" why="Set the class's assessments (tests, assignments, exam and their weights) on the website's class page, then enter marks here." />;
  if (submitted) return <SuccessState title="Results submitted" reassurance="Your marks are locked and sent for approval." next="The Head of Department reviews them, then the Dean, then the Registry publishes them to students." />;
  const saved = (sid: string) => w.marks.find((m) => m.assessmentId === aid && m.studentId === sid);
  const shown = (sid: string) => (draft.value[sid] as string | undefined) ?? (saved(sid)?.absent ? 'ABS' : saved(sid)?.score?.toString() ?? '');
  const problem = (v: string) => {
    if (!v || v === 'ABS') return null;
    const n = Number(v);
    if (Number.isNaN(n)) return 'Enter a number, or ABS for absent.';
    if (n < 0 || n > (a?.maxScore ?? 100)) return `Between 0 and ${a?.maxScore}.`;
    return null;
  };
  const bad = w.students.some((s) => problem(shown(s.id)));
  const save = () => void run(async () => {
    const entries = Object.entries(draft.value).map(([studentId, v]) => ({ assessmentId: aid, studentId, absent: v === 'ABS', score: v === 'ABS' || v === '' ? null : Number(v) }));
    put(cacheKey, await resultsApi.saveMarks(w.offering.id, entries));
    draft.clear();
  });
  return (
    <View style={{ gap: space.md }}>
      <Notice tone={w.sheet.status === 'DRAFT' ? 'info' : 'success'} title={SHEET_STATUS[w.sheet.status]}>{w.sheet.returnNote ? `Returned: ${w.sheet.returnNote}` : w.canEdit ? 'Marks can be changed until you submit.' : 'Marks are locked.'}</Notice>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {w.assessments.map((x) => <Chip key={x.id} label={`${x.name} (${x.weight}%)`} selected={x.id === aid} onPress={() => setAid(x.id)} />)}
      </ScrollView>
      <FormError error={error} />
      {w.students.map((s) => (
        <Card key={s.id} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{s.firstName} {s.lastName}</Text>
            <Text variant="small" tone="muted">{s.indexNumber}</Text>
          </View>
          <View style={{ width: 110 }}>
            <TextField label={`out of ${a?.maxScore}`} value={shown(s.id)} editable={w.canEdit} keyboardType="decimal-pad" autoCapitalize="characters" onChangeText={(v) => draft.set(s.id, v.toUpperCase().replace(',', '.'))} error={problem(shown(s.id))} />
          </View>
        </Card>
      ))}
      {w.canEdit ? <Button label="Save marks" disabled={bad || !Object.keys(draft.value).length} loading={busy} onPress={save} /> : null}
      {w.canEdit && w.isLead ? <Button label="Submit results for approval" variant="secondary" disabled={Object.keys(draft.value).length > 0} loading={busy} onPress={() => void run(async () => { put(cacheKey, await resultsApi.submit(w.offering.id)); setSubmitted(true); })} /> : null}
      {Object.keys(draft.value).length && w.canEdit && w.isLead ? <Text variant="small" tone="muted">Save your changes before submitting.</Text> : null}
    </View>
  );
}
