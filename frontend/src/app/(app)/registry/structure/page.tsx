'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AcademicStructure } from '@/features/registry/components/academic-structure';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ACADEMICS_MANAGE}>
      <PageHeader title="Academic structure" description="Schools, departments and the programmes each department runs." />
      <AcademicStructure />
    </RequirePermission>
  );
}
