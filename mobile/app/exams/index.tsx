import type { MyExams } from '@/api/exams';
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

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Exams() {
  const q = useQuery<MyExams>('me.exams', '/me/exams');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exams" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(d) => d.papers.length === 0 ? (
          <EmptyState title="No exams to show" why="Your exams appear once your course registration is approved and the Exams Office publishes the timetable." />
        ) : (
          <>
            {!d.timetablePublishedAt ? <Notice tone="info" title="Timetable not published yet">Dates and venues appear here when the Exams Office publishes them. You will get a notification.</Notice> : null}
            {d.papers.map((p) => (
              <Card key={p.offeringId}>
                <Text variant="heading">{p.course.code} {p.course.title}</Text>
                {p.exam ? <Text>{when(p.exam.startsAt)}, {p.exam.durationMinutes} minutes{p.exam.venue ? `, ${p.exam.venue}` : ''}{p.seatNumber ? `, seat ${p.seatNumber}` : ''}</Text> : <Text tone="muted">Date not set yet.</Text>}
                {p.exam?.notes ? <Text variant="small" tone="muted">{p.exam.notes}</Text> : null}
                {p.eligibility ? (
                  p.eligibility.status === 'ELIGIBLE' ? <Badge label="You can sit this paper" tone="success" /> : (
                    <Notice tone="danger" title="Not eligible yet">{`${p.eligibility.reasons.join(' ')} Sort this out with the office named before the exam.`}</Notice>
                  )
                ) : null}
              </Card>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
