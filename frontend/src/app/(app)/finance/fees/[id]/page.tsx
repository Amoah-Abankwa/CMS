'use client';

import { use } from 'react';
import Link from 'next/link';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FeeBill } from '@/features/fees/components/fee-bill';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <Link href="/finance/fees" className="mb-2 inline-block text-sm text-primary hover:underline">All bills</Link>
      <FeeBill id={id} />
    </RequirePermission>
  );
}
