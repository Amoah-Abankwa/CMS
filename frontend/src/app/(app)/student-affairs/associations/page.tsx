'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AssociationsAdmin } from '@/features/fees/components/associations-admin';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ASSOCIATIONS_MANAGE}>
      <PageHeader title="Departmental associations" description="EHASSA, BACA and the others: departments, elected officers, dues and receipts." />
      <AssociationsAdmin />
    </RequirePermission>
  );
}
