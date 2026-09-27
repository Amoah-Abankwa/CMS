'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { MyExams } from '@/features/exams/components/my-exams';

export default function StudentExamsPage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Exams" />
      {isStudent ? <MyExams /> : <EmptyState title="This page is for students" description="Staff exam tools are under Examinations in the sidebar." />}
    </>
  );
}
