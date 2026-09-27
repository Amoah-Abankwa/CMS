'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VenuesManager } from '@/features/exams/components/venues-manager';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.EXAMS_MANAGE}>
      <PageHeader title="Exam venues" description="Halls and rooms used for exams, with the number of seats available under exam conditions." />
      <VenuesManager />
    </RequirePermission>
  );
}
