import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { ClassAttendance } from '@/api/attendance';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';
import { RegisterView } from './RegisterView';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AttendanceTab({ offeringId }: { offeringId: string }) {
  const { space } = useTheme();
  const q = useQuery<ClassAttendance>(`teach.attendance.${offeringId}`, `/teaching/classes/${offeringId}/attendance`);
  const [session, setSession] = useState<string | null>(null);
  if (session) return <RegisterView offeringId={offeringId} sessionId={session} onBack={() => { setSession(null); q.refresh(); }} />;
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
      {(d) => {
        const live = d.sessions.filter((s) => !s.cancelledAt);
        const below = d.students.filter((s) => s.belowMinimum).length;
        return (
          <View style={{ gap: space.sm }}>
            {below ? <Badge label={`${below} below the ${d.policy.minimumPercent}% minimum`} tone="danger" /> : null}
            {live.length === 0 ? <EmptyState title="No class sessions yet" why="Sessions are scheduled on the website's class page (weekly lectures, tutorials or labs). Then take registers here." /> : live.map((s) => (
              <Pressable key={s.id} accessibilityRole="button" onPress={() => setSession(s.id)}>
                <Card style={{ padding: 12 }}>
                  <Text variant="label">{when(s.startsAt)}{s.venue ? `, ${s.venue}` : ''}</Text>
                  <Text variant="small" tone="muted">{s.topic ?? s.kind.toLowerCase()}. {s.attendanceTakenAt ? `${s.counts.present} present, ${s.counts.late} late, ${s.counts.absent} absent` : 'Register not taken'}</Text>
                  {s.checkInOpen ? <Badge label="Check-in open" tone="success" /> : null}
                </Card>
              </Pressable>
            ))}
          </View>
        );
      }}
    </QueryView>
  );
}
