'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { LibraryRulesForm } from '@/features/library/components/library-rules-form';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_MANAGE}>
      <PageHeader title="Library rules" description="Loan lengths, limits, fines and reservations." />
      <LibraryRulesForm />
    </RequirePermission>
  );
}
