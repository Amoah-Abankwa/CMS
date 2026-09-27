'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SheetDetail } from '@/features/results/components/sheet-detail';

export default function ResultSheetPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <Link href="/academics/results" className="mb-3 inline-block text-sm text-primary hover:underline print:hidden">
        Results approval
      </Link>
      <SheetDetail id={id} />
    </>
  );
}
