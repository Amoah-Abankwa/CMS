'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCedis, WEEKDAY_NAMES } from '@anu/shared';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { foodApi, type VendorPublic } from '../api';

/** Today's hours as text, e.g. "07:00 to 14:00, 17:00 to 21:00". */
export function todaysHours(v: Pick<VendorPublic, 'openingHours'>) {
  const slots = v.openingHours[String(new Date().getUTCDay())] ?? [];
  return slots.length ? slots.map(([a, b]) => `${a} to ${b}`).join(', ') : `Closed on ${WEEKDAY_NAMES[new Date().getUTCDay()]}s`;
}

export function VendorList() {
  const [vendors, setVendors] = useState<Array<VendorPublic & { itemsAvailable: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { foodApi.vendors().then(setVendors).catch((err) => setError(errorMessage(err))); }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!vendors) return <Spinner />;
  if (!vendors.length) return <EmptyState title="No vendors yet" />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {vendors.map((v) => (
        <li key={v.id}>
          <Link href={`/food/${v.id}`} className="block rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary">
            <span className="flex items-start justify-between gap-2">
              <span className="font-medium">{v.name}</span>
              <Badge tone={v.openNow ? 'success' : 'neutral'}>{v.openNow ? 'Open' : v.paused ? 'Paused' : 'Closed'}</Badge>
            </span>
            <span className="block text-sm text-muted">{v.location}</span>
            {v.description && <span className="mt-1 block text-sm">{v.description}</span>}
            <span className="mt-2 block text-xs text-muted">
              Today: {todaysHours(v)}. {v.offersDelivery ? `Delivers for ${formatCedis(v.deliveryFee)}. ` : 'Pickup only. '}
              {v.acceptsOnline && v.acceptsPayOnPickup ? 'Pay online or at the counter.' : v.acceptsOnline ? 'Pay online.' : 'Pay at the counter.'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
