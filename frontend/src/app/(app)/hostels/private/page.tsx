'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PrivateVerification } from '@/features/accommodation/components/private-verification';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <PageHeader title="Private hostels" description="Verify private hostels before students can see them, and manage their owners' accounts." />
      <PrivateVerification />
    </RequirePermission>
  );
}
