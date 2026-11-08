import { View } from 'react-native';
import { attendanceApi, type MyAttendance } from '@/api/attendance';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CodeCheckIn } from '@/features/checkin/CodeCheckIn';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function Attendance() {
  const { space } = useTheme();
  const q = useQuery<MyAttendance>('me.attendance', '/me/attendance');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Attendance" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => (
          <>
            {d.upcoming.some((u) => u.checkInOpen) ? (
              <CodeCheckIn title="Check in to your class" hint="Your lecturer shows the code at the start of class." onDone={q.refresh} submit={async (code) => {
                const r = await attendanceApi.checkIn(code);
                return { headline: r.alreadyRecorded ? 'Already checked in' : r.status === 'LATE' ? 'Checked in (late)' : 'Checked in', detail: `${r.course.code} ${r.course.title}: you are marked ${r.status === 'LATE' ? 'late' : 'present'}.` };
              }} />
            ) : null}
            {d.courses.length === 0 ? <EmptyState title="No classes yet" why="Attendance appears once your registration is approved and your lecturers start taking registers." /> : d.courses.map((c) => (
              <Card key={c.offeringId}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="label" style={{ flex: 1 }}>{c.course.code} {c.course.title}</Text>
                  <Text variant="heading" tone={c.belowMinimum ? 'danger' : 'default'}>{c.summary?.percent != null ? `${Math.round(c.summary.percent)}%` : '-'}</Text>
                </View>
                <ProgressBar value={c.summary?.percent != null ? c.summary.percent / 100 : 0} />
                {c.summary ? <Text variant="small" tone="muted">{c.summary.present} present, {c.summary.late} late, {c.summary.absent} absent, {c.summary.excused} excused</Text> : <Text variant="small" tone="muted">No registers taken yet.</Text>}
                {c.belowMinimum ? <Badge label={`Below the ${d.policy.minimumPercent}% minimum`} tone="danger" /> : null}
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
