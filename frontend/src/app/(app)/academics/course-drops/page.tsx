'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CourseDropRequests } from '@/features/registration/components/registration-records';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.COURSE_DROPS_APPROVE}>
      <PageHeader title="Course drop requests" description="Students asking to drop a course from their approved registration." />
      <CourseDropRequests />
    </RequirePermission>
  );
}
