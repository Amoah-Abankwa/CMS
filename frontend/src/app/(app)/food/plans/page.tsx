'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { MyMealPlans } from '@/features/marketplace/components/food-extras';

export default function Page() {
  return (
    <>
      <PageHeader title="My meal plans" description="Meals you have paid for, and how many are left." />
      <Suspense fallback={<Spinner />}><MyMealPlans /></Suspense>
    </>
  );
}
