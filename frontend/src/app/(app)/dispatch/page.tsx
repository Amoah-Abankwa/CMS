'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DispatchBoard } from '@/features/dispatch/components/dispatch-board';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.DISPATCH_DELIVER}>
      <PageHeader title="Deliveries" description="Take a delivery, collect it from the vendor, and hand it over when the customer gives you their code." />
      <DispatchBoard />
    </RequirePermission>
  );
}
