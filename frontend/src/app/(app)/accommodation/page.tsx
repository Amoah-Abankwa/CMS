'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { MyAccommodation } from '@/features/accommodation/components/my-accommodation';

export default function AccommodationPage() {
  const isStudent = useAuthStore((s) => s.me?.type === 'STUDENT');
  return (
    <>
      <PageHeader title="Accommodation" description="Apply for a university hostel, find a verified private hostel, or tell us where you live." />
      {isStudent ? <MyAccommodation /> : <EmptyState title="This page is for students" />}
    </>
  );
}
