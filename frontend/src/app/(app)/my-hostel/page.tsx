'use client';

import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MyHostel } from '@/features/accommodation/components/my-hostel';

export default function Page() {
  return (
    <RequirePermission permission={PERMISSIONS.PRIVATE_HOSTEL_OWN}>
      <PageHeader title="My hostel" description="Your listings, room types, prices and the students asking for beds." />
      <MyHostel />
    </RequirePermission>
  );
}
