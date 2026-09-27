'use client';

import { Suspense } from 'react';
import { Spinner } from '@/components/ui/states';
import { DemoCheckout } from '@/features/marketplace/components/demo-checkout';

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <DemoCheckout />
    </Suspense>
  );
}
