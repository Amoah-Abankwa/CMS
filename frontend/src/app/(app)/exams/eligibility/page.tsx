'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { EligibilityManager } from '@/features/exams/components/eligibility-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EXAMS_MANAGE}>
      <PageHeader title="Exam eligibility" description="Decide who may sit each paper from fee clearance, class attendance and holds, review exceptions, then publish to students." />
      <EligibilityManager />
    </RequirePermission>
  );
}
