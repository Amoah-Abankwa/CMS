'use client';

import { use } from 'react';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FeeReceiptView } from '@/features/fees/components/fee-documents';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission permission={PERMISSIONS.FEES_MANAGE}>
      <FeeReceiptView id={id} admin />
    </RequirePermission>
  );
}
