'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MenuEditor } from '@/features/marketplace/components/menu-editor';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.VENDOR_OWN}>
      <PageHeader title="Menu" description="Dishes, prices and what is available right now." />
      <MenuEditor />
    </RequirePermission>
  );
}
