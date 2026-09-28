'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AdvisorAssignments } from '@/features/registrations/components/advisor-assignments';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ADVISORS_ASSIGN}>
      <PageHeader title="Academic advisors" description="Give each student their own advisor, who then reviews their course registration." />
      <AdvisorAssignments />
    </RequirePermission>
  );
}
