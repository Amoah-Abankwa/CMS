'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CurriculumManager } from '@/features/curriculum/components/curriculum';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.CURRICULUM_MANAGE}>
      <PageHeader title="Courses and curriculum" description="Add and edit courses and their prerequisites, and set each programme's courses semester by semester." />
      <CurriculumManager />
    </RequirePermission>
  );
}
