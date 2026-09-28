'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelOwnerPayouts } from '@/features/accommodation/components/hostel-fees';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Hostel owner payouts" description="Online private hostel fees held by the university, and payouts to owners." />
      <HostelOwnerPayouts />
    </RequirePermission>
  );
}
