'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { BankStatementImport } from '@/features/fees/components/instalments-and-statement';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Bank statement" description="Record bank deposits from the bank statement." />
      <BankStatementImport />
    </RequirePermission>
  );
}
