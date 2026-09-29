'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RetentionSettings } from '@/features/admin/components/retention-settings';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
      <PageHeader title="Records retention" description="How long records are kept." />
      <RetentionSettings />
    </RequirePermission>
  );
}
