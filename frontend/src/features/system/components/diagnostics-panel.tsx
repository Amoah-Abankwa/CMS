'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/axios';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

interface Diagnostics {
  nodeVersion: string;
  uptimeSeconds: number;
  memoryMb: { rss: number; heapUsed: number };
  dbLatencyMs: number;
  notifications: { queued: number; failed: number };
  activeSessions: number;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function DiagnosticsPanel() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Diagnostics>('/system/diagnostics').then((r) => setData(r.data)).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader title="Runtime" />
        <CardBody>
          <dl className="divide-y divide-border">
            <Row label="Node.js" value={data.nodeVersion} />
            <Row label="Uptime" value={`${Math.floor(data.uptimeSeconds / 3600)} h ${Math.floor((data.uptimeSeconds % 3600) / 60)} min`} />
            <Row label="Memory in use" value={`${data.memoryMb.heapUsed} MB of ${data.memoryMb.rss} MB`} />
            <Row label="Database round trip" value={`${data.dbLatencyMs} ms`} />
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Queues and sessions" />
        <CardBody>
          <dl className="divide-y divide-border">
            <Row label="Messages waiting to send" value={data.notifications.queued} />
            <Row label="Messages that failed" value={data.notifications.failed} />
            <Row label="Active sessions" value={data.activeSessions} />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
