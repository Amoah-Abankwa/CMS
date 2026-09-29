'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { Payroll } from '@/features/employment/components/opportunities';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PAYROLL_MANAGE}>
      <PageHeader title="Student payroll" description="Approved timesheets to pay." />
      <Payroll />
    </RequirePermission>
  );
}
