import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { APPLICATION_STATUS_LABEL, formatCedis, PAY_UNIT_LABEL } from '@anu/shared';
import type { OpenJobs } from '@/api/employment';
import { EmptyState } from '@/components/states/EmptyState';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

const until = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Jobs() {
  const q = useQuery<OpenJobs>('work.jobs', '/me/work/jobs');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Campus jobs" />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => (
          <>
            {!d.standing.eligibility.eligible ? <Notice tone="warning" title="You cannot apply right now">{d.standing.eligibility.reasons.join(' ')}</Notice> : null}
            {d.jobs.length === 0 ? <EmptyState title="No open jobs" why="Career Services posts campus jobs, internships and assistantships here. Check back, or turn on notifications." /> : d.jobs.map((j) => (
              <Pressable key={j.id} accessibilityRole="button" onPress={() => router.push(`/jobs/${j.id}` as never)}>
                <Card>
                  <Text variant="heading">{j.title}</Text>
                  <Text variant="small" tone="muted">{j.organisation ?? j.unit}. {formatCedis(j.payRate)} {PAY_UNIT_LABEL[j.payUnit]}, about {j.hoursPerWeek} hours a week. Closes {until(j.closesAt)}.</Text>
                  {j.myStatus ? <Badge label={APPLICATION_STATUS_LABEL[j.myStatus]} tone="primary" /> : null}
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
