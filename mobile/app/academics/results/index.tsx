import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Sheet } from '@/api/results';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { SHEET_STATUS } from '@/features/teaching/sheetStatus';
import { useQuery } from '@/hooks/useQuery';

export default function ResultsApproval() {
  const q = useQuery<{ semester: { label: string }; items: Sheet[] }>('review.sheets', '/results/sheets');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Results approval" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => {
          const mine = d.items.filter((s) => s.canAct);
          const rest = d.items.filter((s) => !s.canAct);
          if (!d.items.length) return <EmptyState title="No result sheets yet" why="Sheets appear here once lecturers submit their marks." />;
          return (
            <>
              {mine.length === 0 ? <Text tone="muted">Nothing is waiting for you right now.</Text> : null}
              {[...mine, ...rest].map((s) => (
                <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/academics/results/${s.id}` as never)}>
                  <Card>
                    <Text variant="heading">{s.offering.course.code} {s.offering.course.title}</Text>
                    <Text variant="small" tone="muted">{s.summary.students} students{s.summary.passRate != null ? `, ${Math.round(s.summary.passRate)}% passed` : ''}</Text>
                    <Badge label={s.canAct ? `Waiting for you to ${s.nextAction}` : SHEET_STATUS[s.status]} tone={s.canAct ? 'warning' : 'neutral'} />
                  </Card>
                </Pressable>
              ))}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
