'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { MyResults } from '@/features/results/components/my-results';

export default function StudentResultsPage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Results" />
      {isStudent ? <MyResults /> : <EmptyState title="This page is for students" />}
    </>
  );
}
