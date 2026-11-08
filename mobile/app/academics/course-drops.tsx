import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { axiosInstance } from '@/lib/api';

interface DropRow { id: string; reason: string; createdAt: string; student: { firstName: string; lastName: string; indexNumber: string | null; studentProfile: { programme: { name: string } } | null }; offering: { course: { code: string; title: string; creditHours: number } } }

export default function CourseDrops() {
  const q = useQuery<DropRow[]>('review.drops', '/course-drops');
  const decide = async (id: string, approve: boolean, note?: string) => { await axiosInstance.post(`/course-drops/${id}/decide`, { approve, note }); q.refresh(); };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Course drop requests" />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="Nothing waiting" why="No student has asked to drop a course since the last decision." /> : <>{list.map((r) => (
          <DecisionCard key={r.id} rejectLabel="Reject" onApprove={() => decide(r.id, true)} onReject={(note) => decide(r.id, false, note)}>
            <Text variant="heading">{r.student.firstName} {r.student.lastName}</Text>
            <Text variant="small" tone="muted">{r.student.indexNumber}{r.student.studentProfile ? `, ${r.student.studentProfile.programme.name}` : ''}</Text>
            <Text>Drop {r.offering.course.code} {r.offering.course.title} ({r.offering.course.creditHours} credits)</Text>
            <Text variant="small">“{r.reason}”</Text>
          </DecisionCard>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
