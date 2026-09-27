'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { JobsAdmin } from '@/features/employment/components/jobs-admin';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYMENT_MANAGE}>
      <PageHeader title="Campus jobs" description="Post jobs, then open each one to review applicants." />
      <JobsAdmin />
    </RequirePermission>
  );
}
