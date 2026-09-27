'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HostelRooms } from '@/features/accommodation/components/hostel-rooms';

export default function HostelPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission={PERMISSIONS.HOSTELS_MANAGE}>
      <Link href="/hostels" className="mb-3 inline-block text-sm text-primary hover:underline">University hostels</Link>
      <HostelRooms hostelId={id} />
    </RequirePermission>
  );
}
