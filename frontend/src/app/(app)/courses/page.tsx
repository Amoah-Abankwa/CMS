'use client';

import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { MyCourses } from '@/features/registration/components/my-courses';

export default function Page() {
  const student = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="My courses" description="Every course you have registered for. Passed courses are in green, failed ones in red." />
      {student ? <MyCourses /> : <EmptyState title="This page is for students" />}
    </>
  );
}
