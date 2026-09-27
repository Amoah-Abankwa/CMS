'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { fullName } from '@/lib/format';
import { attendanceApi } from '../api';
import { AttendanceBar } from './attendance-bar';

type Data = Awaited<ReturnType<typeof attendanceApi.courseReport>>;

export function CourseAttendanceReport({ offeringId }: { offeringId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    attendanceApi.courseReport(offeringId).then(setData).catch((err) => setError(errorMessage(err)));
  }, [offeringId]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const sorted = [...data.students].sort((a, b) => (a.summary?.percent ?? 101) - (b.summary?.percent ?? 101));

  return (
    <>
      <PageHeader
        title={`${data.offering.course.code} ${data.offering.course.title}`}
        description={`${data.offering.semesterLabel}. Lowest attendance first. Minimum ${data.policy.minimumPercent}%.`}
        actions={<Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>}
      />
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Student</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Present</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Late</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Absent</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Excused</th>
              <th scope="col" className="px-4 py-2 font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2"><span className="font-mono text-xs text-muted">{s.indexNumber}</span> {fullName(s)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.summary?.present ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.summary?.late ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.summary?.absent ?? 0}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.summary?.excused ?? 0}</td>
                <td className="px-4 py-2"><AttendanceBar percent={s.summary?.percent ?? null} minimum={data.policy.minimumPercent} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
