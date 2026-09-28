'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ProgrammeTypes } from '@/features/registry/components/programme-types';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.ACADEMICS_MANAGE}>
      <PageHeader title="Programme types and index numbers" description="Bachelor's (regular and weekend), Diploma, Graduate School: their length in semesters and index number format, and the exam fee clearance rule." />
      <ProgrammeTypes />
    </RequirePermission>
  );
}
