'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VendorsAdmin } from '@/features/marketplace/components/vendors-admin';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.MARKETPLACE_MANAGE}>
      <PageHeader title="Food vendors" description="Add vendors, approve or suspend them, and set marketplace rules." />
      <VendorsAdmin />
    </RequirePermission>
  );
}
