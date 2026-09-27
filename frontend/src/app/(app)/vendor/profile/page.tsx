'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ShopSettings } from '@/features/marketplace/components/shop-settings';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.VENDOR_OWN}>
      <PageHeader title="Shop settings" description="Hours, pickup and delivery, payment options and payouts." />
      <ShopSettings />
    </RequirePermission>
  );
}
