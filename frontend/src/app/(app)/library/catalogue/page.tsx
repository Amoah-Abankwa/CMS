'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CatalogueManager } from '@/features/library/components/catalogue-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_MANAGE}>
      <PageHeader title="Catalogue" description="Every title the library holds, with its copies and reservations." />
      <CatalogueManager />
    </RequirePermission>
  );
}
