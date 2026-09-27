'use client';

import { Suspense } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Spinner } from '@/components/ui/states';
import { MyAttendance } from '@/features/attendance/components/my-attendance';

export default function StudentAttendancePage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Attendance" />
      {isStudent ? (
        <Suspense fallback={<Spinner />}>
          <MyAttendance />
        </Suspense>
      ) : (
        <EmptyState title="This page is for students" description="Lecturers take attendance from My classes." />
      )}
    </>
  );
}
