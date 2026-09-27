'use client';

import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { DevotionScreen } from '@/features/devotion/components/devotion-screen';

export default function DevotionScreenPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission={PERMISSIONS.DEVOTION_MANAGE}>
      <DevotionScreen serviceId={id} />
    </RequirePermission>
  );
}
