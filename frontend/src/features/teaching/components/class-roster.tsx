'use client';

import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Spinner } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/axios';
import { downloadCsv as saveCsv } from '@/lib/csv';
import { formatDateTime, fullName } from '@/lib/format';
import type { Offering, RosterStudent } from '@/features/offerings/api';
import { teachingApi } from '../api';

function downloadCsv(filename: string, students: RosterStudent[]) {
  const rows = [
    ['Index number', 'Name', 'Programme', 'Level', 'Email'],
    ...students.map((s) => [s.indexNumber, fullName(s), s.studentProfile?.programme.name, s.studentProfile?.currentLevel, s.email]),
  ];
  saveCsv(filename, rows);
}

export function ClassRoster({ offeringId }: { offeringId: string }) {
  const [data, setData] = useState<{ offering: Offering; semesterLabel: string; students: RosterStudent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teachingApi.roster(offeringId).then(setData).catch((err) => setError(errorMessage(err)));
  }, [offeringId]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const { offering, students } = data;

  return (
    <>
      <PageHeader
        title={`${offering.course.code} ${offering.course.title}`}
        description={`${data.semesterLabel}. ${students.length} approved students. ${offering.lecturers.map((l) => l.name).join(', ')}.`}
        actions={
          students.length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print
              </Button>
              <Button variant="secondary" size="sm" onClick={() => downloadCsv(`${offering.course.code.replace(/\s/g, '')}-class-list.csv`, students)}>
                <Download className="size-4" aria-hidden /> Download CSV
              </Button>
            </>
          )
        }
      />
      <div className="mb-3 hidden print:block">
        <p className="font-bold">All Nations University</p>
        <p className="text-sm">Class list printed {formatDateTime(new Date())}</p>
      </div>
      {students.length === 0 ? (
        <EmptyState title="No approved students yet" description="Students appear here once their course registration is approved." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface print:border-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">No.</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Index number</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell print:table-cell">Programme</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 tabular-nums text-muted">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono">{s.indexNumber}</td>
                  <td className="px-4 py-2">{fullName(s)}</td>
                  <td className="hidden px-4 py-2 text-muted sm:table-cell print:table-cell">{s.studentProfile?.programme.name}</td>
                  <td className="px-4 py-2 tabular-nums">{s.studentProfile?.currentLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
