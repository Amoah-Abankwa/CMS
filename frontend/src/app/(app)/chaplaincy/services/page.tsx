'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ServicesManager } from '@/features/devotion/components/services-manager';

export default function DevotionServicesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_MANAGE}>
      <PageHeader title="Devotion services" description="The semester's morning devotions. Open the projector screen for self check-in, and door entry for ushers." />
      <ServicesManager />
    </RequirePermission>
  );
}
