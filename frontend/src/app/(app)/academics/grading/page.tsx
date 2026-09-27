'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { GradingScaleEditor } from '@/features/results/components/grading-scale-editor';

export default function GradingPage() {
  return (
    <RequirePermission permission={PERMISSIONS.GRADING_MANAGE}>
      <PageHeader title="Grading scale" description="How total marks out of 100 turn into grades and grade points. Totals are rounded to a whole number before grading." />
      <Card>
        <CardBody>
          <GradingScaleEditor />
        </CardBody>
      </Card>
    </RequirePermission>
  );
}
