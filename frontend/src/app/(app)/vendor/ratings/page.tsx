'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VendorRatings } from '@/features/marketplace/components/food-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.VENDOR_OWN}>
      <PageHeader title="Ratings" description="What customers said after their orders." />
      <VendorRatings />
    </RequirePermission>
  );
}
