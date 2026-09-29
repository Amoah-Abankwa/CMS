'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelComplaintsDesk } from '@/features/accommodation/components/hostel-complaints';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <PageHeader title="Hostel complaints" description="Complaints from students about private hostels." />
      <HostelComplaintsDesk />
    </RequirePermission>
  );
}
