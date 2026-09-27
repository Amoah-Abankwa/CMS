'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCedis, ORDER_STATUS_LABEL } from '@anu/shared';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { foodApi, STATUS_TONE, type Order } from '../api';

export function MyOrders() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Order[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { foodApi.orders(page).then(setData).catch((err) => setError(errorMessage(err))); }, [page]);
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  if (!data.items.length) return <EmptyState title="No orders yet" action={<Link href="/food" className="text-sm text-primary hover:underline">Find something to eat</Link>} />;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <ul className="divide-y divide-border">
        {data.items.map((o) => (
          <li key={o.id}>
            <Link href={`/food/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
              <span className="min-w-0 text-sm">
                <span className="font-medium">#{o.number} {o.vendor.name}</span>
                <span className="block truncate text-xs text-muted">{o.items.map((i) => `${i.quantity} x ${i.name}`).join(', ')}. {formatDateTime(o.createdAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2"><span className="text-sm tabular-nums">{formatCedis(o.total)}</span><Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-3"><Pagination page={page} pageSize={20} total={data.total} onChange={setPage} /></div>
    </div>
  );
}
