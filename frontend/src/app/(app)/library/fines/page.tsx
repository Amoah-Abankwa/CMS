'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FinesManager } from '@/features/library/components/fines-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_CIRCULATE}>
      <PageHeader title="Library fines" description="Take payments at the desk. The Librarian can waive fines with a reason." />
      <FinesManager />
    </RequirePermission>
  );
}
