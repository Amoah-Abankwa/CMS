'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DuesMarker } from '@/features/exams/components/dues-marker';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.RESULTS_APPROVE_DEPARTMENT}>
      <PageHeader title="Dues on exam registers" description="Choose whether invigilators see which of your students have unpaid compulsory dues." />
      <DuesMarker />
    </RequirePermission>
  );
}
