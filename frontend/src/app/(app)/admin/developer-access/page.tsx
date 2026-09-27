'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DeveloperAccessList } from '@/features/developer/components/developer-access-list';

export default function DeveloperAccessPage() {
  return (
    <RequirePermission permission={PERMISSIONS.DEVELOPER_ACCESS_MANAGE}>
      <PageHeader
        title="Developer access"
        description="Developer access is off for everyone by default. Turn it on only for staff who need system diagnostics, ideally with an expiry. Each change asks for your authenticator code."
      />
      <DeveloperAccessList />
    </RequirePermission>
  );
}
