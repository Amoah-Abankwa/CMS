'use client';

import { PageHeader } from '@/components/ui/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/states';
import { ExamRegister } from '@/features/exams/components/exam-register';

export default function Page() {
  const staff = useAuthStore((s) => s.me?.type === 'STAFF');
  return (
    <>
      <PageHeader title="Exam register" description="Mark attendance for the papers you invigilate. Seat numbers, eligibility, fee clearance and unpaid dues are shown for each candidate." />
      {staff ? <ExamRegister /> : <EmptyState title="This page is for staff" />}
    </>
  );
}
