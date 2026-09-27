'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RulesForm } from '@/features/devotion/components/rules-form';

export default function DevotionRulesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_MANAGE}>
      <PageHeader title="Devotion rules" description="Days, times and how the semester total is worked out." />
      <Card><CardBody><RulesForm /></CardBody></Card>
    </RequirePermission>
  );
}
