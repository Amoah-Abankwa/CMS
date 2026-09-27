'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ResidenceOverview } from '@/features/accommodation/components/residence-overview';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ACCOMMODATION_READ}>
      <PageHeader title="Where students live" description="Every student enrolled this semester and where they are staying." />
      <ResidenceOverview />
    </RequirePermission>
  );
}
