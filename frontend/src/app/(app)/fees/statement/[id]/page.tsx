'use client';

import { use } from 'react';
import Link from 'next/link';
import { FeeStatementView } from '@/features/fees/components/fee-documents';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <Link href="/fees" className="mb-2 inline-block text-sm text-primary hover:underline print:hidden">Back to fees</Link>
      <FeeStatementView billId={id} />
    </>
  );
}
