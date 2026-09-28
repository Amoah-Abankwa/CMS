'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelFeesDesk } from '@/features/accommodation/components/hostel-fees';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PRIVATE_HOSTEL_OWN}>
      <PageHeader title="Hostel fees" description="Fees for your hostel this semester: record cash and MoMo payments; online payments are paid to you by the university." />
      <HostelFeesDesk />
    </RequirePermission>
  );
}
