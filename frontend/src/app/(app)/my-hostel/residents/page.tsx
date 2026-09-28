'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelResidents } from '@/features/accommodation/components/hostel-paperwork';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PRIVATE_HOSTEL_OWN}>
      <PageHeader title="Residents" description="Check students in and out, and the forms they must return." />
      <HostelResidents />
    </RequirePermission>
  );
}
