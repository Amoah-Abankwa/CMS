'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { JobsBoard } from '@/features/employment/components/jobs-board';

export default function Page() {
  const student = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Campus jobs" description="Part-time work on campus, and deliveries as a campus dispatcher." />
      {student ? <JobsBoard /> : <EmptyState title="Campus jobs are for students" />}
    </>
  );
}
