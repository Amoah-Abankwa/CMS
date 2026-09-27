'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CourseAttendanceReport } from '@/features/attendance/components/course-attendance-report';

export default function CourseAttendancePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission={PERMISSIONS.ATTENDANCE_REPORTS_READ}>
      <Link href="/academics/attendance" className="mb-3 inline-block text-sm text-primary hover:underline print:hidden">Attendance reports</Link>
      <CourseAttendanceReport offeringId={id} />
    </RequirePermission>
  );
}
