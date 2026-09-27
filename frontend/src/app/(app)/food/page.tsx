'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { VendorList } from '@/features/marketplace/components/vendor-list';

export default function FoodPage() {
  const member = useAuthStore((s) => s.me?.type === 'STUDENT' || s.me?.type === 'STAFF');
  return (
    <>
      <PageHeader title="Food" description="Order from campus vendors for pickup or delivery." actions={member ? <Link href="/food/orders" className="text-sm text-primary hover:underline">My orders</Link> : undefined} />
      {member ? <VendorList /> : <EmptyState title="Food ordering is for students and staff" />}
    </>
  );
}
