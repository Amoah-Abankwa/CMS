'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RatingsModeration } from '@/features/marketplace/components/food-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.MARKETPLACE_MANAGE}>
      <PageHeader title="Food ratings" description="Customer comments on vendors." />
      <RatingsModeration />
    </RequirePermission>
  );
}
