'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AttendanceReport } from '@/features/attendance/components/attendance-report';

export default function AttendanceReportPage() {
  return (
    <RequirePermission permission={PERMISSIONS.ATTENDANCE_REPORTS_READ}>
      <PageHeader title="Attendance reports" description="Attendance by course in your area, with classes that still need a register and students below the minimum." />
      <AttendanceReport />
    </RequirePermission>
  );
}
