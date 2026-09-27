'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FeeBills } from '@/features/fees/components/fee-bills';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <PageHeader title="Student fees" description="Every student's bill this semester: what is due, paid and owed, and who is cleared for exams." />
      <FeeBills />
    </RequirePermission>
  );
}
