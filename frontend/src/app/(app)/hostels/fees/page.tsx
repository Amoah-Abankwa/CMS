'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelFeesDesk } from '@/features/accommodation/components/hostel-fees';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <PageHeader title="Hall fees" description="Hall fees for university halls this semester: record cash, MoMo and bank payments, and see who still owes." />
      <HostelFeesDesk />
    </RequirePermission>
  );
}
