'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DispatchersAdmin } from '@/features/employment/components/dispatchers-admin';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYMENT_MANAGE}>
      <PageHeader title="Dispatchers" description="Approve students who want to deliver, and suspend or end dispatchers." />
      <DispatchersAdmin />
    </RequirePermission>
  );
}
