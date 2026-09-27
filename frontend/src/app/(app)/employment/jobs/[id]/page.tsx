'use client';

import { use } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { JobApplicants } from '@/features/employment/components/job-applicants';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYMENT_MANAGE}>
      <Link href="/employment/jobs" className="mb-2 inline-block text-sm text-primary hover:underline">All jobs</Link>
      <JobApplicants id={id} />
    </RequirePermission>
  );
}
