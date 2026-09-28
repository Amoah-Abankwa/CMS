'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ExchangeRates } from '@/features/fees/components/exchange-rates';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Exchange rates" description="Cedis per US dollar, used for dollar bills and payments made in the other currency." />
      <ExchangeRates />
    </RequirePermission>
  );
}
