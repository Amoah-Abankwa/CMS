import { View } from 'react-native';
import type { MyResults } from '@/api/results';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function Results() {
  const { space, colors } = useTheme();
  const q = useQuery<MyResults>('me.results', '/me/results');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Results" />
      <QueryView q={q} skeleton={<><SkeletonCard lines={2} /><SkeletonCard lines={4} /></>}>
        {(d) => d.semesters.length === 0 ? (
          <EmptyState title="No results yet" why="Results appear here once your department and the Registry publish them, usually a few weeks after exams." action={{ label: 'Check again', onPress: q.refresh }} />
        ) : (
          <>
            <Card>
              <Text variant="small" tone="muted">Cumulative GPA</Text>
              <Text variant="title">{d.cgpa?.toFixed(2) ?? 'Not yet'}</Text>
              <Text variant="small" tone="muted">{d.creditsPassed} of {d.creditsAttempted} credits passed</Text>
            </Card>
            {d.semesters.map((s) => (
              <Card key={s.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="heading">{s.label}</Text>
                  <Text variant="label">GPA {s.gpa?.toFixed(2) ?? '-'}</Text>
                </View>
                {s.courses.map((c) => (
                  <View key={c.code} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderLeftWidth: 4, borderLeftColor: c.incomplete ? colors.warning : c.isPass ? colors.success : colors.danger, paddingLeft: space.sm, paddingVertical: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{c.code} {c.title}</Text>
                      <Text variant="small" tone="muted">{c.credits} credits, {c.total} marks</Text>
                    </View>
                    <Text variant="heading">{c.grade}</Text>
                    {c.incomplete ? <Badge label="Incomplete" tone="warning" /> : !c.isPass ? <Badge label="Failed" tone="danger" /> : null}
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
