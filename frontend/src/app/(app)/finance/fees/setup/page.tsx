'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FeeSetup } from '@/features/fees/components/fee-setup';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Fee set-up" description="Fee schedules for each semester, issuing bills, and the clearance rule." />
      <FeeSetup />
    </RequirePermission>
  );
}
