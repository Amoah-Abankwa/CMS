'use client';

import Link from 'next/link';
import { PERMISSIONS } from '@anu/shared';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { StaffList } from '@/features/staff/components/staff-list';

export default function StaffPage() {
  const canCreate = useAuthStore((s) => s.can(PERMISSIONS.USERS_MANAGE));
  return (
    <RequirePermission permission={PERMISSIONS.USERS_READ}>
      <PageHeader
        title="Staff"
        description="Everyone with a staff account and the roles they hold. A staff member can hold several roles."
        actions={
          canCreate && (
            <Link href="/staff/new" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              Add staff member
            </Link>
          )
        }
      />
      <StaffList />
    </RequirePermission>
  );
}
