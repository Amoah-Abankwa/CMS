'use client';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { Opportunities } from '@/features/employment/components/opportunities';

export default function Page() {
  const ok = useAuthStore((s) => s.me?.type === 'STAFF');
  return (
    <>
      <PageHeader title="Opportunities" description="Post internships, and teaching and research assistantships; choose students and approve their timesheets." />
      {ok ? <Opportunities /> : <EmptyState title="This page is for staff" />}
    </>
  );
}
