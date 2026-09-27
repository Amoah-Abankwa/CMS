'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';
import { auditApi, type AuditEntry } from '@/features/audit/api';
import { actionLabel } from '@/features/audit/labels';

export function RecentActivity() {
  const [items, setItems] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    auditApi.mine({}, 1, 5).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []);

  return (
    <Card>
      <CardHeader
        title="Your recent activity"
        actions={
          <Link href="/activity" className="text-sm text-primary hover:underline">
            Full log
          </Link>
        }
      />
      {!items ? (
        <Spinner />
      ) : (
        <CardBody className="py-0">
          <ul className="divide-y divide-border">
            {items.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-3 text-sm">
                <span className={e.result === 'FAILURE' ? 'text-danger' : ''}>{actionLabel(e.action)}</span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(e.occurredAt)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}
