'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { OrdersBoard } from '@/features/marketplace/components/orders-board';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.VENDOR_OWN}>
      <PageHeader title="Orders" description="New orders appear here as they come in. Accept them, mark them ready, and ask for the customer's code when you hand over." />
      <OrdersBoard />
    </RequirePermission>
  );
}
