'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { Settlements } from '@/features/marketplace/components/settlements';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.MARKETPLACE_MANAGE}>
      <PageHeader title="Vendor settlements" description="Online payments collected for each vendor, commission, and payouts recorded." />
      <Settlements />
    </RequirePermission>
  );
}
