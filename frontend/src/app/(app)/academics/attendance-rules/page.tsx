'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AttendanceRulesForm } from '@/features/attendance/components/attendance-rules-form';

export default function AttendanceRulesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.ACADEMICS_MANAGE}>
      <PageHeader title="Attendance rules" description="University-wide settings for class attendance." />
      <Card><CardBody><AttendanceRulesForm /></CardBody></Card>
    </RequirePermission>
  );
}
