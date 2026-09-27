'use client';

import { PageHeader } from '@/components/ui/page-header';
import { SheetsList } from '@/features/results/components/sheets-list';

/** Access is decided by the API from the active role's result permissions. */
export default function ResultsApprovalPage() {
  return (
    <>
      <PageHeader title="Results approval" description="Each course's results pass from the Head of Department to the Dean, then to the Exam Coordinator or Registry to publish." />
      <SheetsList />
    </>
  );
}
