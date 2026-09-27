'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { SemestersTable } from '@/features/academics/components/semesters-table';

export default function SemestersPage() {
  return (
    <RequirePermission permission={PERMISSIONS.ACADEMICS_MANAGE}>
      <PageHeader title="Semesters" description="Set when course registration opens and closes, and the credit limits students must stay within." />
      <SemestersTable />
    </RequirePermission>
  );
}
