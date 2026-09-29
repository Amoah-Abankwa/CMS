'use client';

import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { ClearanceDesk } from '@/features/library/components/library-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_CIRCULATE}>
      <PageHeader title="Library clearance" description="Check graduating students and issue clearance certificates." />
      <ClearanceDesk />
    </RequirePermission>
  );
}
