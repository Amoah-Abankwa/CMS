'use client';

import { use } from 'react';
import Link from 'next/link';
import { JobView } from '@/features/employment/components/job-view';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/jobs" className="mb-2 inline-block text-sm text-primary hover:underline">All jobs</Link>
      <JobView id={id} />
    </div>
  );
}
