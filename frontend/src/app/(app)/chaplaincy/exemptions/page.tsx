'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DevotionExemptions } from '@/features/devotion/components/exemptions';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_MANAGE}>
      <PageHeader title="Devotion exemptions" description="Students excused from morning devotion this semester." />
      <DevotionExemptions />
    </RequirePermission>
  );
}
