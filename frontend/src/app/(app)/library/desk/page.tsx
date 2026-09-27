'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CirculationDesk } from '@/features/library/components/circulation-desk';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_CIRCULATE}>
      <PageHeader title="Circulation desk" description="Issue, return and renew books. Works with a barcode scanner." />
      <CirculationDesk />
    </RequirePermission>
  );
}
