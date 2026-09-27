'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { OfferingsManager } from '@/features/offerings/components/offerings-manager';

export default function OfferingsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.OFFERINGS_MANAGE}>
      <PageHeader title="Course offerings" description="Choose which courses run this semester and who teaches them. Students can only register for courses listed here." />
      <OfferingsManager />
    </RequirePermission>
  );
}
