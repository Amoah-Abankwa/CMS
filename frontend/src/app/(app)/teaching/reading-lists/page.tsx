'use client';

import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { ReadingListEditor } from '@/features/library/components/library-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.TEACHING_READ}>
      <PageHeader title="Reading lists" description="Books and references for the courses you teach. Students see them with library availability." />
      <ReadingListEditor />
    </RequirePermission>
  );
}
