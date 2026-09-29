'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VendorMealPlans } from '@/features/marketplace/components/food-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.VENDOR_OWN}>
      <PageHeader title="Meal plans" description="Bundles of meals customers pay for once and use one per order." />
      <VendorMealPlans />
    </RequirePermission>
  );
}
