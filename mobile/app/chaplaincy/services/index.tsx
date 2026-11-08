import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { DevotionServiceRow } from '@/api/devotion';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Services() {
  const q = useQuery<{ semester: { label: string }; expected: number; items: DevotionServiceRow[] }>('chapel.services', '/devotion/services');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Devotion services" subtitle={q.data ? `${q.data.semester.label}, ${q.data.expected} students expected` : undefined} />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => {
          const list = [...d.items].sort((a, b) => (a.date.slice(0, 10) === today ? -1 : b.date.slice(0, 10) === today ? 1 : b.date.localeCompare(a.date)));
          return list.length === 0 ? <EmptyState title="No services scheduled" why="Generate the semester's services on the website's Devotion services page first." /> : <>{list.slice(0, 40).map((s) => (
            <Pressable key={s.id} accessibilityRole="button" disabled={!!s.cancelledAt} onPress={() => router.push(`/chaplaincy/services/${s.id}` as never)}>
              <Card style={{ padding: 12 }}>
                <Text variant="label">{day(s.date)}{s.theme ? `: ${s.theme}` : ''}</Text>
                <Text variant="small" tone="muted">{s.counts.early} on time, {s.counts.late} late, {s.counts.absent} absent</Text>
                {s.cancelledAt ? <Badge label="Cancelled" /> : s.live ? <Badge label="Happening now" tone="success" /> : s.closedAt ? <Badge label="Closed" /> : null}
              </Card>
            </Pressable>
          ))}</>;
        }}
      </QueryView>
    </Screen>
  );
}
