'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { MyFees } from '@/features/fees/components/my-fees';

export default function Page() {
  return (
    <>
      <PageHeader title="Fees" description="Your bill, payments and receipts, and whether you are cleared for exams." />
      <Suspense fallback={<Spinner />}>
        <MyFees />
      </Suspense>
    </>
  );
}
