'use client';

import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { IllDesk } from '@/features/library/components/library-extras';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_CIRCULATE}>
      <PageHeader title="Inter-library loans" description="Books borrowed from other libraries for members." />
      <IllDesk />
    </RequirePermission>
  );
}
