import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { CourseReportRow } from '@/api/attendance';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

export default function AttendanceReports() {
  const q = useQuery<{ semester: { label: string }; policy: { minimumPercent: number }; items: CourseReportRow[] }>('att.reports', '/attendance/reports');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Attendance reports" subtitle={q.data ? `${q.data.semester.label}. Minimum ${q.data.policy.minimumPercent}%.` : undefined} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No classes yet" why="Courses appear once they have students and sessions." /> : <>{[...d.items].sort((a, b) => b.belowMinimum - a.belowMinimum).map((r) => (
          <Pressable key={r.offeringId} accessibilityRole="button" onPress={() => router.push(`/academics/attendance/${r.offeringId}` as never)}>
            <Card>
              <Text variant="heading">{r.course.code} {r.course.title}</Text>
              <Text variant="small" tone="muted">{r.lecturer ?? 'No lecturer'}. {r.students} students, {r.classesHeld} classes{r.classesWithoutRegister ? `, ${r.classesWithoutRegister} without a register` : ''}. Average {r.averagePercent != null ? `${Math.round(r.averagePercent)}%` : '-'}.</Text>
              {r.belowMinimum ? <Badge label={`${r.belowMinimum} below the minimum`} tone="danger" /> : null}
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
