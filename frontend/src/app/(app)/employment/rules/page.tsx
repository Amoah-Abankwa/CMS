'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { EmploymentRules } from '@/features/employment/components/employment-rules';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYMENT_MANAGE}>
      <PageHeader title="Employment rules" description="Minimum CGPA and other requirements, and what dispatchers are paid." />
      <EmploymentRules />
    </RequirePermission>
  );
}
