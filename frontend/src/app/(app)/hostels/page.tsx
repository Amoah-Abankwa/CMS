'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelsOverview } from '@/features/accommodation/components/hostels-overview';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <PageHeader title="University hostels" description="Halls, rooms and how full they are this semester." />
      <HostelsOverview />
    </RequirePermission>
  );
}
