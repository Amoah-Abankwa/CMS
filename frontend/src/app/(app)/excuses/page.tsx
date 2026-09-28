'use client';

import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/states';
import { MyExcuseRequests } from '@/features/attendance/components/excuse-requests';

export default function Page() {
  const student = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Excuse requests" description="Ask to be excused from classes and morning devotion, with a supporting document." />
      {student ? <MyExcuseRequests /> : <EmptyState title="This page is for students" />}
    </>
  );
}
