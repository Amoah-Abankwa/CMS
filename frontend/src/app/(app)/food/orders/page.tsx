'use client';

import { PageHeader } from '@/components/ui/page-header';
import { MyOrders } from '@/features/marketplace/components/my-orders';

export default function Page() {
  return (
    <>
      <PageHeader title="My food orders" />
      <MyOrders />
    </>
  );
}
