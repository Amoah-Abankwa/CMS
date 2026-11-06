'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { attendanceApi } from '../api';
import { AttendanceBar } from './attendance-bar';

type Report = Awaited<ReturnType<typeof attendanceApi.report>>;

export function AttendanceReport() {
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    attendanceApi.report(semesterId || undefined).then(setData).catch((err) => setError(errorMessage(err)));
  }, [semesterId]);

  return (
    <div className="flex flex-col gap-4">
      {semesters && <div className="max-w-sm"><SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} /></div>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.items.length === 0 && <EmptyState title="No courses in your area this semester" />}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {data.items.map((r) => (
            <li key={r.offeringId}>
              <Link href={`/academics/attendance/${r.offeringId}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 text-sm">
                  <span className="font-medium"><span className="font-mono">{r.course.code}</span> {r.course.title}</span>
                  <span className="block text-xs text-muted">
                    {r.course.department.name}. {r.lecturer ?? 'No lecturer'}. {r.students} students, {r.classesHeld} classes recorded.
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {r.classesWithoutRegister > 0 && <Badge tone="warning">{r.classesWithoutRegister} without a register</Badge>}
                  {r.belowMinimum > 0 && <Badge tone="danger">{r.belowMinimum} below {data.policy.minimumPercent}%</Badge>}
                  <AttendanceBar percent={r.averagePercent} minimum={data.policy.minimumPercent} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
