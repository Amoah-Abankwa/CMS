'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { notificationsApi, type NotificationPage } from '@/features/notifications/api';

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    notificationsApi.list(page, PAGE_SIZE).then(setData).catch((err) => setError(errorMessage(err)));
  }, [page]);

  useEffect(load, [load]);

  const markAll = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  const open = async (id: string, read: boolean) => {
    if (!read) {
      await notificationsApi.markRead(id);
      load();
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          data && data.unread > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAll}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No notifications yet" description="Results, internal marks, exam timetables and eligibility updates will appear here." />}
      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n.id, !!n.readAt)} className={cn('w-full px-4 py-3 text-left hover:bg-surface-muted', !n.readAt && 'bg-primary-soft/40')}>
                  <p className="text-sm font-medium">
                    {!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Unread" />}
                    {n.title}
                  </p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}
