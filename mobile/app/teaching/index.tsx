import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Offering } from '@/api/offerings';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

export default function MyClasses() {
  const q = useQuery<{ semester: { label: string }; items: Offering[] }>('teach.classes', '/teaching/classes');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="My classes" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No classes this term" why="Your Head of Department assigns lecturers to courses. Classes you teach appear here." /> : <>{d.items.map((o) => (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/teaching/${o.id}` as never)}>
            <Card>
              <Text variant="heading">{o.course.code} {o.course.title}</Text>
              <Text variant="small" tone="muted">{o.enrolled} students{o.capacity ? ` of ${o.capacity}` : ''}</Text>
              {o.lecturers.some((l) => l.isLead) ? <Badge label={`Lead: ${o.lecturers.find((l) => l.isLead)!.name}`} /> : null}
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
