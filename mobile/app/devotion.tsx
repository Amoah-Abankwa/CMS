import { devotionApi, type MyDevotion } from '@/api/devotion';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CodeCheckIn } from '@/features/checkin/CodeCheckIn';
import { useQuery } from '@/hooks/useQuery';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const LABEL = { EARLY: 'On time', LATE: 'Late', ABSENT: 'Absent', EXCUSED: 'Excused' } as const;

export default function Devotion() {
  const q = useQuery<MyDevotion>('me.devotion', '/me/devotion');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Morning devotion" subtitle={q.data?.semester.label} />
      <QueryView q={q} skeleton={<><SkeletonCard lines={2} /><SkeletonCard lines={4} /></>}>
        {(d) => !d.expected ? (
          <EmptyState title="Devotion is not expected of you" why="You are exempt this semester, so there is nothing to check in to or score." />
        ) : (
          <>
            <Card>
              <Text variant="small" tone="muted">{d.final ? 'Final score' : 'Score so far'}</Text>
              <Text variant="title">{d.final ? `${d.final.score} of ${d.final.totalMarks}` : d.summary.score ?? '-'}</Text>
              <Text variant="small" tone="muted">{d.summary.early} on time, {d.summary.late} late, {d.summary.absent} absent, {d.summary.excused} excused</Text>
            </Card>
            {d.next ? <Text>Next service: {day(d.next.date)}{d.next.theme ? `, ${d.next.theme}` : ''}</Text> : null}
            <CodeCheckIn title="Check in" hint="The code is on the screen at the chapel entrance." onDone={q.refresh} submit={async (code) => {
              const r = await devotionApi.checkIn(code);
              return { headline: r.alreadyRecorded ? 'Already checked in' : 'Checked in', detail: `You are recorded as ${LABEL[r.status as keyof typeof LABEL]?.toLowerCase() ?? r.status}.` };
            }} />
            {d.history.slice(0, 20).map((h) => <Text key={h.id} variant="small">{day(h.date)}: {LABEL[h.status as keyof typeof LABEL] ?? h.status}{h.theme ? `, ${h.theme}` : ''}</Text>)}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
