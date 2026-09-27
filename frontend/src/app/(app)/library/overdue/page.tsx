'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { OverdueAndHolds } from '@/features/library/components/overdue-and-holds';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_CIRCULATE}>
      <PageHeader title="Overdue and reservations" description="Books that are late, and copies kept for someone to collect." />
      <OverdueAndHolds />
    </RequirePermission>
  );
}
