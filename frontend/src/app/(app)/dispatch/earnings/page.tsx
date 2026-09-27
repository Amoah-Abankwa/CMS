'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { Earnings } from '@/features/dispatch/components/earnings';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.DISPATCH_DELIVER}>
      <PageHeader title="My earnings" description="What you have earned per delivery, and payments made to your mobile money." />
      <Earnings />
    </RequirePermission>
  );
}
