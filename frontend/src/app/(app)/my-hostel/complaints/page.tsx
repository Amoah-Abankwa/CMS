'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelComplaintsDesk } from '@/features/accommodation/components/hostel-complaints';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PRIVATE_HOSTEL_OWN}>
      <PageHeader title="Complaints" description="Complaints from students about your hostels." />
      <HostelComplaintsDesk owner />
    </RequirePermission>
  );
}
