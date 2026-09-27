'use client';

import { Suspense } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Spinner } from '@/components/ui/states';
import { MyDevotion } from '@/features/devotion/components/my-devotion';

export default function DevotionPage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Morning devotion" />
      {isStudent ? <Suspense fallback={<Spinner />}><MyDevotion /></Suspense> : <EmptyState title="This page is for students" description="Chaplaincy tools are under Chaplaincy in the sidebar." />}
    </>
  );
}
