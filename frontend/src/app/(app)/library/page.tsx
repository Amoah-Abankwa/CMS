'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { MyLibrary } from '@/features/library/components/my-library';

export default function LibraryPage() {
  const member = useAuthStore((s) => s.me?.type === 'STUDENT' || s.me?.type === 'STAFF');
  return (
    <>
      <PageHeader title="Library" description="Your books, due dates, reservations and any fines. Borrow and return at the library desk." />
      {member ? <MyLibrary /> : <EmptyState title="The library is for students and staff" />}
    </>
  );
}
