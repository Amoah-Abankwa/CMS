'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { OfficerDues } from '@/features/fees/components/officer-dues';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.DUES_COLLECT}>
      <PageHeader title="Association dues" description="Set dues, see who has paid, and record cash payments. Every cash payment gets a numbered receipt sent to the student." />
      <OfficerDues />
    </RequirePermission>
  );
}
