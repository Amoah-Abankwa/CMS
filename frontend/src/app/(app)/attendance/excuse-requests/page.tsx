'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ExcuseRequestsReview } from '@/features/attendance/components/excuse-requests';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE}>
      <PageHeader title="Excuse requests" description="Students asking to be excused, with their documents." />
      <ExcuseRequestsReview />
    </RequirePermission>
  );
}
