'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HoldsManager } from '@/features/exams/components/holds-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EXAM_HOLDS_MANAGE}>
      <PageHeader title="Exam holds" description="Stop a student sitting one paper or all their papers, for example pending a disciplinary case." />
      <HoldsManager />
    </RequirePermission>
  );
}
