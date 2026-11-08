import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

interface Demand { course: string; title: string; students: number; copies: number; hasEbook: boolean; shortBy: number }

export default function ReadingListDemand() {
  const q = useQuery<Demand[]>('lib.demand', '/library/reading-lists/demand');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Reading lists" subtitle="Essential books on this term's lists, against the copies the library has." />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(list) => list.length === 0 ? <EmptyState title="No essential books listed" why="Lecturers add reading lists for their courses; essential books show here." /> : <>{list.map((d, i) => (
          <Card key={`${d.course}${d.title}${i}`} style={{ padding: 10 }}>
            <Text variant="label">{d.title}</Text>
            <Text variant="small" tone="muted">{d.course}. {d.students} students, {d.copies} copies{d.hasEbook ? ', e-book available' : ''}.</Text>
            {d.shortBy > 0 ? <Badge label={`About ${d.shortBy} more copies needed`} tone="warning" /> : <Badge label="Enough copies" tone="success" />}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
