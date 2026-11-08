import { useState } from 'react';
import { View } from 'react-native';
import { termDates, termName } from '@anu/shared';
import { academicsApi, type AcademicYearRow, type Semester } from '@/api/academics';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { SemesterSettings } from '@/features/calendar/SemesterSettings';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function Calendar() {
  const { space } = useTheme();
  const years = useQuery<AcademicYearRow[]>('cal.years', '/academics/years');
  const sems = useQuery<Semester[]>('cal.semesters', '/academics/semesters');
  const [label, setLabel] = useState('');
  const { busy, error, run } = useSubmit();
  const refresh = () => { years.refresh(); sems.refresh(); };
  const m = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  const labelError = label && (!m || Number(m[2]) !== Number(m[1]) + 1) ? 'Write the year as 2026/2027.' : null;
  return (
    <Screen refreshing={years.loading} onRefresh={refresh}>
      <Header title="Academic calendar" subtitle="Fall, Spring and Summer of each academic year." />
      <Card>
        <FormError error={error} />
        <TextField label="New academic year" value={label} placeholder="2026/2027" onChangeText={setLabel} error={labelError} hint="It runs from 1 September to 31 August." />
        <Button label="Create year" disabled={!m || !!labelError} loading={busy} onPress={() => void run(async () => { await academicsApi.createYear({ label: label.trim(), startDate: `${m![1]}-09-01`, endDate: `${m![2]}-08-31` }); setLabel(''); refresh(); })} />
      </Card>
      <QueryView q={years} skeleton={<SkeletonList rows={4} />}>
        {(ys) => ys.length === 0 ? <EmptyState title="No academic years yet" why="Create the current year above, then add its terms." /> : <>{ys.map((y) => (
          <Card key={y.id}>
            <Text variant="heading">{y.label}{y.isCurrent ? ' (current)' : ''}</Text>
            {y.semesters.map((ys2) => {
              const full = sems.data?.find((s) => s.id === ys2.id);
              return full ? <SemesterSettings key={ys2.id} s={{ ...full, summerKind: ys2.summerKind }} onSaved={refresh} /> : <Text key={ys2.id}>{termName(ys2.number)}</Text>;
            })}
            <View style={{ gap: space.sm }}>
              {[1, 2, 3].filter((n) => !y.semesters.some((s) => s.number === n)).map((n) => (
                <Button key={n} label={`Add ${termName(n)}`} variant="secondary" loading={busy} onPress={() => void run(async () => { await academicsApi.createSemester(y.id, { number: n, ...termDates(Number(y.label.slice(0, 4)), n) }); refresh(); })} />
              ))}
            </View>
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
