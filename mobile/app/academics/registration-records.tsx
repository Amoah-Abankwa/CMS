import { useState } from 'react';
import { ScrollView } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

type Tab = 'dropped' | 'rejected-registrations' | 'rejected-drops' | 'malpractice';
const TABS: Record<Tab, string> = { dropped: 'Dropped courses', 'rejected-registrations': 'Rejected registrations', 'rejected-drops': 'Rejected drop requests', malpractice: 'Malpractice' };
type Row = { id: string; student: { firstName: string; lastName: string; indexNumber: string | null }; reason?: string; decisionNote?: string | null; reviewNote?: string | null; courses?: string; offering?: { course: { code: string; title: string } } | null; offence?: string; sanction?: string | null; occurredOn?: string };

export default function RegistrationRecords() {
  const { space } = useTheme();
  const [tab, setTab] = useState<Tab>('dropped');
  const q = useQuery<{ semester: string; rows: Row[] }>(`records.${tab}`, `/registration-records/${tab}`);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Registration records" subtitle={q.data?.semester} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {(Object.keys(TABS) as Tab[]).map((t) => <Chip key={t} label={TABS[t]} selected={tab === t} onPress={() => setTab(t)} />)}
      </ScrollView>
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.rows.length === 0 ? <EmptyState title={`No ${TABS[tab].toLowerCase()}`} why="Nothing of this kind for the current semester in your departments." /> : <>{d.rows.map((r) => (
          <Card key={r.id} style={{ padding: 12 }}>
            <Text variant="label">{r.student.firstName} {r.student.lastName} <Text variant="small" tone="muted">{r.student.indexNumber}</Text></Text>
            {r.offering ? <Text>{r.offering.course.code} {r.offering.course.title}</Text> : null}
            {r.courses ? <Text variant="small">{r.courses}</Text> : null}
            {r.offence ? <Text>{r.offence}</Text> : null}
            {r.sanction ? <Text variant="small">Sanction: {r.sanction}</Text> : null}
            {r.reason ? <Text variant="small" tone="muted">Asked: {r.reason}</Text> : null}
            {r.decisionNote || r.reviewNote ? <Text variant="small" tone="muted">Decision: {r.decisionNote ?? r.reviewNote}</Text> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
