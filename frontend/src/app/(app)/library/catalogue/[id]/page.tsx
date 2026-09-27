'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { TitleManager } from '@/features/library/components/title-manager';

export default function TitlePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission={PERMISSIONS.LIBRARY_MANAGE}>
      <Link href="/library/catalogue" className="mb-3 inline-block text-sm text-primary hover:underline">Catalogue</Link>
      <TitleManager titleId={id} />
    </RequirePermission>
  );
}
