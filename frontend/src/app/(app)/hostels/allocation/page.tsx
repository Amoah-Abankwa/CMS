'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AllocationManager } from '@/features/accommodation/components/allocation-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <PageHeader title="Applications and allocation" description="Open applications, confirm special needs, allocate beds, and publish offers." />
      <AllocationManager />
    </RequirePermission>
  );
}
