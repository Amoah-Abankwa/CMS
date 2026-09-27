'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DiagnosticsPanel } from '@/features/system/components/diagnostics-panel';

export default function SystemPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SYSTEM_DIAGNOSTICS_READ}>
      <PageHeader title="System diagnostics" description="Runtime health. No personal data is shown here." />
      <DiagnosticsPanel />
    </RequirePermission>
  );
}
