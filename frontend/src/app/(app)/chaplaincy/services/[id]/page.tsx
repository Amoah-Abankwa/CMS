'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ServiceDetail } from '@/features/devotion/components/service-detail';

export default function DevotionServicePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_MANAGE}>
      <Link href="/chaplaincy/services" className="mb-3 inline-block text-sm text-primary hover:underline">Devotion services</Link>
      <ServiceDetail serviceId={id} />
    </RequirePermission>
  );
}
