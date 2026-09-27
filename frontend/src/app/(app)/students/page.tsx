'use client';

import Link from 'next/link';
import { PERMISSIONS } from '@anu/shared';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { StudentsList } from '@/features/students/components/students-list';

export default function StudentsPage() {
  const canRegister = useAuthStore((s) => s.can(PERMISSIONS.STUDENTS_REGISTER));
  return (
    <RequirePermission permission={PERMISSIONS.STUDENTS_READ}>
      <PageHeader
        title="Students"
        actions={
          canRegister && (
            <Link href="/students/new" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              Register student
            </Link>
          )
        }
      />
      <StudentsList />
    </RequirePermission>
  );
}
