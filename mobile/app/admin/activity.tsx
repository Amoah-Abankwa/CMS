import { useState } from 'react';
import type { AuditPage } from '@/api/audit';
import { actionLabel } from '@/api/auditLabels';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';

export default function AllActivity() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery<AuditPage>(`activity.all.${search}.${page}`, '/audit', { page, pageSize: 30, search: search.trim() || undefined });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="All activity" subtitle="Everything recorded on the platform, newest first. The record cannot be changed." />
      <TextField label="Search" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="A name, email, index number or action" />
      <QueryView q={q} skeleton={<SkeletonList rows={10} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nothing found" why={search ? `Nothing matches "${search}".` : 'No activity recorded yet.'} /> : (
          <>
            {d.items.map((a) => (
              <Card key={a.id} style={{ padding: 10 }}>
                <Text variant="label">{actionLabel(a.action)}</Text>
                <Text variant="small" tone="muted">{a.actorLabel ?? 'System'}, {new Date(a.occurredAt).toLocaleString()}{a.ipAddress ? `, ${a.ipAddress}` : ''}</Text>
                {a.result === 'FAILURE' ? <Badge label="Did not succeed" tone="danger" /> : null}
              </Card>
            ))}
            {d.total > page * d.pageSize ? <Button label="Older" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
