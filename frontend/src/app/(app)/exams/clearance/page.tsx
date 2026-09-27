'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ClearanceManager } from '@/features/exams/components/clearance-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.FINANCE_CLEARANCE_MANAGE}>
      <PageHeader title="Fee clearance" description="Mark students who have met their fee obligations for this semester. Only cleared students can be eligible for exams." />
      <ClearanceManager />
    </RequirePermission>
  );
}
