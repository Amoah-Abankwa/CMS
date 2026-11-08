import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { resultsApi, type SheetDetail } from '@/api/results';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { SHEET_STATUS } from '@/features/teaching/sheetStatus';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function SheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space, colors } = useTheme();
  const q = useQuery<SheetDetail>(`review.sheet.${id}`, `/results/sheets/${id}`);
  const [done, setDone] = useState<string | null>(null);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? `${q.data.offering.course.code} results` : 'Results'} subtitle={q.data?.offering.course.title} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(s) => (
          <View style={{ gap: space.md }}>
            {done ? <SuccessState title={done} reassurance="The lecturer and the next approver have been told." next={s.status === 'PUBLISHED' ? 'Students can see their results now.' : 'It moves to the next step of approval.'} /> : null}
            <Card>
              <Text variant="label">{SHEET_STATUS[s.status]}</Text>
              <Text variant="small" tone="muted">{s.summary.students} students. Mean {s.summary.mean?.toFixed(1) ?? '-'}, pass rate {s.summary.passRate != null ? `${Math.round(s.summary.passRate)}%` : '-'}, {s.summary.incomplete} incomplete.</Text>
              <Text variant="small">{Object.entries(s.summary.distribution).map(([g, n]) => `${g}: ${n}`).join('  ')}</Text>
            </Card>
            {s.canAct && s.nextAction && !done ? (
              <DecisionCard approveLabel={s.nextAction === 'publish' ? 'Publish to students' : 'Approve'} rejectLabel="Return to the lecturer" onApprove={async () => { await resultsApi.advance(s.id); setDone(s.nextAction === 'publish' ? 'Results published' : 'Results approved'); q.refresh(); }} onReject={async (note) => { await resultsApi.returnSheet(s.id, note); setDone('Returned to the lecturer'); q.refresh(); }}>
                <Text variant="heading">Your decision</Text>
              </DecisionCard>
            ) : null}
            {s.results.map((r) => (
              <View key={r.student.id} style={{ flexDirection: 'row', gap: space.sm, borderLeftWidth: 4, borderLeftColor: r.incomplete ? colors.warning : r.isPass ? colors.success : colors.danger, paddingLeft: space.sm }}>
                <Text style={{ flex: 1 }}>{r.student.firstName} {r.student.lastName} <Text variant="small" tone="muted">{r.student.indexNumber}</Text></Text>
                <Text variant="small">{r.caScore} + {r.examScore} = {r.total}</Text>
                <Text variant="label">{r.grade}</Text>
              </View>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
