'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ReviewList } from '@/features/registration/components/review-list';

export default function RegistrationApprovalsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.REGISTRATIONS_REVIEW}>
      <PageHeader title="Registration approvals" description="Students in your department who have submitted their courses. Approving adds them to each course's class list." />
      <ReviewList />
    </RequirePermission>
  );
}
