'use client';

import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/states';
import { Amendments } from '@/features/results/components/amendments';

export default function Page() {
  const staff = useAuthStore((s) => s.me?.type === 'STAFF');
  return (
    <>
      <PageHeader title="Result amendments" description="Corrections to published results, approved by the Head of Department and the Dean, then applied by the Exams Office or Registrar." />
      {staff ? <Amendments /> : <EmptyState title="This page is for staff" />}
    </>
  );
}
