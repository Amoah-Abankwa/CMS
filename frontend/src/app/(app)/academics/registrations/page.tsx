'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ReviewList } from '@/features/registration/components/review-list';
import { CourseApprovals } from '@/features/registration/components/course-approvals';

export default function RegistrationApprovalsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.REGISTRATIONS_REVIEW}>
      <PageHeader title="Registration approvals" description="Students in your department who have submitted their courses. Approving adds them to each course's class list." />
      <div className="flex flex-col gap-4">
        <ReviewList />
        <CourseApprovals />
      </div>
    </RequirePermission>
  );
}
