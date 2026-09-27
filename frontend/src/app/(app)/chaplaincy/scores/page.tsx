'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ScoresTable } from '@/features/devotion/components/scores-table';

export default function DevotionScoresPage() {
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_READ}>
      <PageHeader title="Devotion scores" description="Every student's score out of the semester total, with their early, late, absent and excused counts." />
      <ScoresTable />
    </RequirePermission>
  );
}
