'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DuesSettlements } from '@/features/fees/components/dues-settlements';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Dues payouts" description="Online departmental dues held for each association, and payouts made." />
      <DuesSettlements />
    </RequirePermission>
  );
}
