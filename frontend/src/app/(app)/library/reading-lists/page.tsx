'use client';

import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { ReadingListEditor } from '@/features/library/components/library-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_MANAGE}>
      <PageHeader title="Reading lists" description="Course reading lists, and essential books short of copies." />
      <ReadingListEditor showDemand />
    </RequirePermission>
  );
}
