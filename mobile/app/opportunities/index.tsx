import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { formatCedis, JOB_KIND_LABEL, TIMESHEET_STATUS_LABEL, type JobKind } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { PostForm } from '@/features/opportunities/PostForm';
import { useQuery } from '@/hooks/useQuery';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

interface Posting { id: string; title: string; kind: JobKind; status: 'DRAFT' | 'PENDING_REVIEW' | 'OPEN' | 'CLOSED'; closesAt: string; applicants: number; waiting: number; hired: number }
interface Sheet { id: string; period: string; status: keyof typeof TIMESHEET_STATUS_LABEL; amount: number; entries: Array<{ date: string; quantity: number }>; application: { student: { firstName: string; lastName: string; indexNumber: string | null }; job: { title: string } } }
const STATUS = { DRAFT: 'Draft', PENDING_REVIEW: 'With Career Services', OPEN: 'Open', CLOSED: 'Closed' } as const;

export default function Opportunities() {
  const { space } = useTheme();
  const list = useQuery<Posting[]>('opps.mine', '/opportunities');
  const sheets = useQuery<Sheet[]>('opps.sheets', '/opportunities/timesheets');
  const review = async (id: string, approve: boolean, note?: string) => { await axiosInstance.post(`/opportunities/timesheets/${id}/review`, { approve, note }); sheets.refresh(); };
  return (
    <Screen refreshing={list.loading} onRefresh={() => { list.refresh(); sheets.refresh(); }}>
      <Header title="Opportunities" subtitle="Internships, assistantships and jobs you post, and timesheets to approve." />
      <QueryView q={sheets} skeleton={null}>
        {(s) => s.filter((t) => t.status === 'SUBMITTED').length ? (
          <View style={{ gap: space.sm }}>
            <Text variant="heading">Timesheets to approve</Text>
            {s.filter((t) => t.status === 'SUBMITTED').map((t) => (
              <DecisionCard key={t.id} rejectLabel="Return to the student" onApprove={() => review(t.id, true)} onReject={(note) => review(t.id, false, note)}>
                <Text variant="label">{t.application.student.firstName} {t.application.student.lastName}, {t.application.job.title}</Text>
                <Text variant="small" tone="muted">{t.period}: {t.entries.length} days, {formatCedis(t.amount)}</Text>
              </DecisionCard>
            ))}
          </View>
        ) : null}
      </QueryView>
      <QueryView q={list} skeleton={<SkeletonList rows={3} />}>
        {(posts) => posts.length === 0 ? <EmptyState title="Nothing posted yet" why="Post an internship or assistantship below; applicants appear here." /> : <>{posts.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/opportunities/${p.id}` as never)}>
            <Card>
              <Text variant="heading">{p.title}</Text>
              <Text variant="small" tone="muted">{JOB_KIND_LABEL[p.kind]}. {p.applicants} applied, {p.hired} hired.</Text>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <Badge label={STATUS[p.status]} tone={p.status === 'OPEN' ? 'success' : p.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'} />
                {p.waiting ? <Badge label={`${p.waiting} to look at`} tone="primary" /> : null}
              </View>
            </Card>
          </Pressable>
        ))}</>}
      </QueryView>
      <PostForm onPosted={list.refresh} />
    </Screen>
  );
}
