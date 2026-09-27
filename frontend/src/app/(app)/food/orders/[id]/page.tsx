'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/states';
import { OrderTracking } from '@/features/marketplace/components/order-tracking';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto w-full max-w-xl">
      <Link href="/food/orders" className="mb-2 inline-block text-sm text-primary hover:underline">My orders</Link>
      <Suspense fallback={<Spinner />}>
        <OrderTracking orderId={id} />
      </Suspense>
    </div>
  );
}
