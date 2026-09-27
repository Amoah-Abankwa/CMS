'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { MyDues } from '@/features/fees/components/my-dues';

export default function Page() {
  return (
    <>
      <PageHeader title="Departmental dues" description="Dues for your departmental association, and your receipts." />
      <Suspense fallback={<Spinner />}>
        <MyDues />
      </Suspense>
    </>
  );
}
