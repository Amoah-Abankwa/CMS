import { useEffect } from 'react';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';

interface Diag { nodeVersion: string; uptimeSeconds: number; memoryMb: { rss: number; heapUsed: number }; dbLatencyMs: number; notifications: { queued: number; failed: number }; activeSessions: number }

export default function System() {
  const q = useQuery<Diag>('system.diag', '/system/diagnostics');
  useEffect(() => { const t = setInterval(q.refresh, 15000); return () => clearInterval(t); }, [q.refresh]);
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="System diagnostics" subtitle="Refreshes every 15 seconds." />
      <QueryView q={q} skeleton={<SkeletonCard lines={6} />}>
        {(d) => (
          <Card>
            <Text>Database answers in {d.dbLatencyMs} ms</Text>
            {d.dbLatencyMs > 200 ? <Badge label="Slow: check the database connection" tone="warning" /> : <Badge label="Healthy" tone="success" />}
            <Text>Running for {Math.floor(d.uptimeSeconds / 3600)} h {Math.floor((d.uptimeSeconds % 3600) / 60)} min on Node {d.nodeVersion}</Text>
            <Text>Memory {d.memoryMb.rss} MB ({d.memoryMb.heapUsed} MB in use)</Text>
            <Text>Messages waiting to send: {d.notifications.queued}. Failed: {d.notifications.failed}.</Text>
            {d.notifications.failed > 0 ? <Text variant="small" tone="warning">Failed messages usually mean the email or SMS settings are wrong.</Text> : null}
            <Text>Signed-in sessions: {d.activeSessions}</Text>
          </Card>
        )}
      </QueryView>
    </Screen>
  );
}
