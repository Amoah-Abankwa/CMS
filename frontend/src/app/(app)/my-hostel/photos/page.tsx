'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelPhotosPage } from '@/features/accommodation/components/hostel-photos';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PRIVATE_HOSTEL_OWN}>
      <PageHeader title="Hostel photos" description="Photos students see when choosing a private hostel." />
      <HostelPhotosPage />
    </RequirePermission>
  );
}
