'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { RegistrationPlanner } from '@/features/registration/components/registration-planner';

export default function RegistrationPage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Course registration" />
      {isStudent ? <RegistrationPlanner /> : <EmptyState title="Course registration is for students" />}
    </>
  );
}
