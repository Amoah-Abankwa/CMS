'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DataImport } from '@/features/imports/components/data-import';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.DATA_IMPORT}>
      <PageHeader title="Import data" description="Bring schools, programmes, courses, staff, students and past results over from the previous system." />
      <DataImport />
    </RequirePermission>
  );
}
