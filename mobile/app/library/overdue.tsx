import { useState } from 'react';
import { View } from 'react-native';
import { formatCedis } from '@anu/shared';
import type { HoldRow, OverdueRow } from '@/api/library';
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

export default function Overdue() {
  const { space } = useTheme();
  const [tab, setTab] = useState<'overdue' | 'holds'>('overdue');
  const overdue = useQuery<OverdueRow[]>('lib.overdue', '/library/overdue');
  const holds = useQuery<HoldRow[]>('lib.holds', '/library/holds');
  return (
    <Screen refreshing={overdue.loading} onRefresh={() => { overdue.refresh(); holds.refresh(); }}>
      <Header title="Overdue and reservations" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label={`Overdue${overdue.data ? ` (${overdue.data.length})` : ''}`} selected={tab === 'overdue'} onPress={() => setTab('overdue')} />
        <Chip label={`Ready to collect${holds.data ? ` (${holds.data.length})` : ''}`} selected={tab === 'holds'} onPress={() => setTab('holds')} />
      </View>
      {tab === 'overdue' ? (
        <QueryView q={overdue} skeleton={<SkeletonList rows={6} />}>
          {(list) => list.length === 0 ? <EmptyState title="Nothing overdue" why="Every book on loan is within its due date." /> : <>{[...list].sort((a, b) => b.days - a.days).map((o) => (
            <Card key={o.id} style={{ padding: 10 }}>
              <Text variant="label">{o.copy.title.title} <Text variant="small" tone="muted">{o.copy.barcode}</Text></Text>
              <Text variant="small">{o.borrower.firstName} {o.borrower.lastName} ({o.borrower.indexNumber ?? o.borrower.email}){o.borrower.phone ? `, ${o.borrower.phone}` : ''}</Text>
              <Text variant="small" tone="danger">{o.days} days late, fine so far {formatCedis(o.fineSoFar)}. {o.overdueNoticeCount} reminders sent.</Text>
            </Card>
          ))}</>}
        </QueryView>
      ) : (
        <QueryView q={holds} skeleton={<SkeletonList rows={4} />}>
          {(list) => list.length === 0 ? <EmptyState title="Nothing waiting" why="Reserved books appear here when a copy comes back for them." /> : <>{list.map((h) => (
            <Card key={h.id} style={{ padding: 10 }}>
              <Text variant="label">{h.title.title}{h.copy ? ` (${h.copy.barcode})` : ''}</Text>
              <Text variant="small">For {h.borrower.firstName} {h.borrower.lastName}, until {new Date(h.expiresAt).toLocaleDateString()}</Text>
            </Card>
          ))}</>}
        </QueryView>
      )}
    </Screen>
  );
}
