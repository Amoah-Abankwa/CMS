'use client';

import { use } from 'react';
import Link from 'next/link';
import { VendorMenu } from '@/features/marketplace/components/vendor-menu';

export default function Page({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = use(params);
  return (
    <>
      <Link href="/food" className="mb-2 inline-block text-sm text-primary hover:underline">All vendors</Link>
      <VendorMenu vendorId={vendorId} />
    </>
  );
}
