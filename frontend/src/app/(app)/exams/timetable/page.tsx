'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { TimetableManager } from '@/features/exams/components/timetable-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EXAMS_MANAGE}>
      <PageHeader title="Exam timetable" description="Schedule each course's paper. Clashes are checked as you go, and students only see the timetable once you publish it." />
      <TimetableManager />
    </RequirePermission>
  );
}
