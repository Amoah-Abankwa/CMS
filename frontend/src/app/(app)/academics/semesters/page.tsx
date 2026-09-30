'use client';

import { useState } from 'react';
import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AcademicYears } from '@/features/academics/components/academic-years';
import { SemestersTable } from '@/features/academics/components/semesters-table';

export default function SemestersPage() {
  const [yearsKey, setYearsKey] = useState(0);
  const [semestersKey, setSemestersKey] = useState(0);
  return (
    <RequirePermission permission={PERMISSIONS.ACADEMICS_MANAGE}>
      <PageHeader title="Academic calendar" description="Academic years and semesters: their dates, when course registration opens and closes, credit limits, and which semester is current." />
      <div className="flex flex-col gap-4">
        <AcademicYears key={yearsKey} onChangedAction={() => setSemestersKey((k) => k + 1)} />
        <SemestersTable reloadKey={semestersKey} onChangedAction={() => setYearsKey((k) => k + 1)} />
      </div>
    </RequirePermission>
  );
}
