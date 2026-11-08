import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ClassAttendance } from '@/api/attendance';
import { QueryView } from '@/components/states/QueryView';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function CourseAttendance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space, colors } = useTheme();
  const q = useQuery<{ offering: { course: { code: string; title: string }; semesterLabel: string }; policy: { minimumPercent: number }; students: ClassAttendance['students'] }>(`att.report.${id}`, `/attendance/reports/${id}`);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title={q.data ? `${q.data.offering.course.code} attendance` : 'Attendance'} subtitle={q.data?.offering.semesterLabel} />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => <>{[...d.students].sort((a, b) => (a.summary?.percent ?? 101) - (b.summary?.percent ?? 101)).map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', gap: space.sm, borderLeftWidth: 4, borderLeftColor: s.belowMinimum ? colors.danger : 'transparent', paddingLeft: space.sm }}>
            <Text style={{ flex: 1 }}>{s.firstName} {s.lastName} <Text variant="small" tone="muted">{s.indexNumber}</Text></Text>
            <Text variant="label" tone={s.belowMinimum ? 'danger' : 'default'}>{s.summary?.percent != null ? `${Math.round(s.summary.percent)}%` : '-'}</Text>
          </View>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
