'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { formatDateTime } from '@/lib/format';
import { notificationsApi, type NotificationItem } from '@/features/notifications/api';

export function RecentNotifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    notificationsApi.list(1, 5).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []);

  return (
    <Card>
      <CardHeader
        title="Latest notifications"
        actions={
          <Link href="/notifications" className="text-sm text-primary hover:underline">
            See all
          </Link>
        }
      />
      {!items && <Spinner />}
      {items?.length === 0 && <EmptyState title="Nothing new" description="Results, timetables and account alerts appear here." />}
      {items && items.length > 0 && (
        <CardBody className="py-0">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="py-3">
                <p className="text-sm font-medium">
                  {!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Unread" />}
                  {n.title}
                </p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}
