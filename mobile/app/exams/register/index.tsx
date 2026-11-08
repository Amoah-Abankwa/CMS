import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

interface Session { id: string; startsAt: string; durationMinutes: number; registerClosedAt: string | null; venue: { name: string } | null; offering: { course: { code: string; title: string } }; _count: { seats: number; attendance: number } }
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ExamRegisters() {
  const q = useQuery<Session[]>('exam.registers', '/exams/register');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam register" subtitle="Papers you invigilate." />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No papers to invigilate" why="The Exams Office assigns invigilators when it publishes the timetable." /> : <>{list.map((s) => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/exams/register/${s.id}` as never)}>
            <Card>
              <Text variant="heading">{s.offering.course.code} {s.offering.course.title}</Text>
              <Text variant="small" tone="muted">{when(s.startsAt)}{s.venue ? `, ${s.venue.name}` : ''}. {s._count.attendance} of {s._count.seats} marked.</Text>
              {s.registerClosedAt ? <Badge label="Register closed" /> : null}
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
