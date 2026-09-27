'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ClassRoster } from '@/features/teaching/components/class-roster';
import { MarksWorkbook } from '@/features/results/components/marks-workbook';
import { ClassAttendance } from '@/features/attendance/components/class-attendance';
import { cn } from '@/lib/cn';

const TABS = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'marks', label: 'Marks and results' },
  { value: 'roster', label: 'Class list' },
] as const;

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('attendance');

  return (
    <RequirePermission permission={PERMISSIONS.TEACHING_READ}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/teaching" className="text-sm text-primary hover:underline">
          My classes
        </Link>
        <div role="tablist" aria-label="Class" className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn('h-9 rounded px-3 text-sm', tab === t.value ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:text-text')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'attendance' && <ClassAttendance offeringId={id} />}
      {tab === 'marks' && <MarksWorkbook offeringId={id} />}
      {tab === 'roster' && <ClassRoster offeringId={id} />}
    </RequirePermission>
  );
}
