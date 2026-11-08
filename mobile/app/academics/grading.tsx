import { useState } from 'react';
import { View } from 'react-native';
import { resultsApi, type GradingScale } from '@/api/results';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

type Band = { letter: string; minScore: string; gradePoint: string; isPass: boolean };

export default function Grading() {
  const q = useQuery<GradingScale>('grading.scale', '/grading/scale');
  const [editing, setEditing] = useState(false);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Grading scale" subtitle={q.data ? `${q.data.name}, version ${q.data.version}. Pass mark ${q.data.passMark}.` : undefined} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(s) => editing ? <Edit s={s} onDone={() => { setEditing(false); q.refresh(); }} /> : (
          <>
            {s.bands.map((b) => <Text key={b.letter}>{b.letter}: {b.minScore} and above, {b.gradePoint} points{b.isPass ? '' : ', a fail'}</Text>)}
            <Button label="Change the scale" variant="secondary" onPress={() => setEditing(true)} />
            <Text variant="small" tone="muted">Changing it makes a new version for results from now on. Published results keep the version they used.</Text>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Edit({ s, onDone }: { s: GradingScale; onDone: () => void }) {
  const { space } = useTheme();
  const [bands, setBands] = useState<Band[]>(s.bands.map((b) => ({ letter: b.letter, minScore: String(b.minScore), gradePoint: String(b.gradePoint), isPass: b.isPass })));
  const [passMark, setPassMark] = useState(String(s.passMark));
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const set = (i: number, b: Partial<Band>) => setBands(bands.map((x, n) => (n === i ? { ...x, ...b } : x)));
  const problem = (b: Band, i: number) => {
    const m = Number(b.minScore); const g = Number(b.gradePoint);
    if (!b.letter.trim()) return 'Give the grade a letter.';
    if (!(m >= 0 && m <= 100)) return 'Minimum score from 0 to 100.';
    if (!(g >= 0 && g <= s.maxGradePoint)) return `Grade points from 0 to ${s.maxGradePoint}.`;
    if (i > 0 && m >= Number(bands[i - 1].minScore)) return 'Each grade must start below the one above it.';
    return null;
  };
  if (saved) return <SuccessState title="New scale saved" reassurance="Results submitted from now on use it." next="Results already published keep the scale they were graded with." action={{ label: 'Done', onPress: onDone }} />;
  return (
    <Card>
      <FormError error={error} />
      <TextField label="Pass mark" value={passMark} keyboardType="number-pad" onChangeText={setPassMark} error={!(Number(passMark) >= 0 && Number(passMark) <= 100) ? 'From 0 to 100.' : null} />
      {bands.map((b, i) => (
        <View key={i} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><TextField label="Grade" value={b.letter} autoCapitalize="characters" onChangeText={(x) => set(i, { letter: x })} /></View>
            <View style={{ flex: 1 }}><TextField label="From score" value={b.minScore} keyboardType="decimal-pad" onChangeText={(x) => set(i, { minScore: x })} /></View>
            <View style={{ flex: 1 }}><TextField label="Points" value={b.gradePoint} keyboardType="decimal-pad" onChangeText={(x) => set(i, { gradePoint: x })} /></View>
          </View>
          <Chip label={b.isPass ? 'A pass' : 'A fail'} selected={b.isPass} onPress={() => set(i, { isPass: !b.isPass })} />
          {problem(b, i) ? <Text variant="small" tone="danger">{problem(b, i)}</Text> : null}
        </View>
      ))}
      <Button label="Save as a new version" disabled={bands.some((b, i) => problem(b, i))} loading={busy} onPress={() => void run(async () => { await resultsApi.saveScale({ name: s.name, passMark: Number(passMark), maxGradePoint: s.maxGradePoint, bands: bands.map((b) => ({ letter: b.letter.trim(), minScore: Number(b.minScore), gradePoint: Number(b.gradePoint), isPass: b.isPass })) }); setSaved(true); })} />
      <Button label="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}
