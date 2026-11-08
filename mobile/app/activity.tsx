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
import { useQuery } from '@/hooks/useQuery';

export default function MyActivity() {
  const [page, setPage] = useState(1);
  const q = useQuery<AuditPage>(`activity.mine.${page}`, '/audit/me', { page, pageSize: 25 });
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="My activity" subtitle="What you have done on the platform, newest first. Sign-ins from other places show here too." />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="Nothing recorded yet" why="Sign-ins and changes you make are recorded here." /> : (
          <>
            {d.items.map((a) => (
              <Card key={a.id} style={{ padding: 12 }}>
                <Text variant="label">{actionLabel(a.action)}</Text>
                <Text variant="small" tone="muted">{new Date(a.occurredAt).toLocaleString()}{a.ipAddress ? `, from ${a.ipAddress}` : ''}</Text>
                {a.result === 'FAILURE' ? <Badge label="Did not succeed" tone="danger" /> : null}
              </Card>
            ))}
            {d.total > page * d.pageSize ? <Button label="Older" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
            {page > 1 ? <Button label="Newer" variant="ghost" onPress={() => setPage(page - 1)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
