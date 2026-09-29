'use client';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { MyWork } from '@/features/employment/components/opportunities';

export default function Page() {
  const ok = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="My work" description="Your paid work: timesheets, payslips and where you are paid." />
      {ok ? <MyWork /> : <EmptyState title="This page is for students" />}
    </>
  );
}
