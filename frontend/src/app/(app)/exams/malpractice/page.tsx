'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MalpracticeDesk } from '@/features/registration/components/registration-records';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EXAMS_MANAGE}>
      <PageHeader title="Exam malpractice" description="Record malpractice cases and their sanctions." />
      <MalpracticeDesk />
    </RequirePermission>
  );
}
