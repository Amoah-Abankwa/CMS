import { registrationApi, type ReviewPage } from '@/api/registration';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';

export default function RegistrationApprovals() {
  const q = useQuery<ReviewPage>('review.registrations', '/registrations', { status: 'SUBMITTED', page: 1, pageSize: 50 });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Registration approvals" subtitle="Students waiting for their courses to be approved." />
      <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nothing waiting" why="Every submitted registration in your departments has been decided." action={{ label: 'Check again', onPress: q.refresh }} /> : <>{d.items.map((r) => (
          <DecisionCard key={r.id} onApprove={async () => { await registrationApi.approve(r.id); q.refresh(); }} onReject={async (note) => { await registrationApi.reject(r.id, note); q.refresh(); }}>
            <Text variant="heading">{r.student.firstName} {r.student.lastName}</Text>
            <Text variant="small" tone="muted">{r.student.indexNumber}{r.student.studentProfile ? `, ${r.student.studentProfile.programme.name}, level ${r.student.studentProfile.currentLevel}` : ''}</Text>
            <Text>{r.courses.map((c) => c.code).join(', ')}</Text>
            <Text variant="label">{r.credits} credits</Text>
          </DecisionCard>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
