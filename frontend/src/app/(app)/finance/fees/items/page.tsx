'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FeeItems } from '@/features/fees/components/fee-items';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Fee items" description="The names used for fees on every schedule, bill, statement and receipt." />
      <FeeItems />
    </RequirePermission>
  );
}
