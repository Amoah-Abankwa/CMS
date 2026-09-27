'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ExcusesManager } from '@/features/attendance/components/excuses-manager';

export default function ExcusesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE}>
      <PageHeader title="Excused absences" description="Record medical and other valid absences. They stop missed classes counting against a student's attendance." />
      <ExcusesManager />
    </RequirePermission>
  );
}
