'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ClassesList } from '@/features/teaching/components/classes-list';

export default function TeachingPage() {
  return (
    <RequirePermission permission={PERMISSIONS.TEACHING_READ}>
      <PageHeader title="My classes" description="Courses you are assigned to teach, with the students approved for each." />
      <ClassesList />
    </RequirePermission>
  );
}
