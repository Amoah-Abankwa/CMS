'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PatronDues } from '@/features/fees/components/patron-dues';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.RESULTS_APPROVE_DEPARTMENT}>
      <PageHeader title="Departmental dues" description="As an association's patron, you set its dues each semester. Officers collect cash; students can also pay online." />
      <PatronDues />
    </RequirePermission>
  );
}
