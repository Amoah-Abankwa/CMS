'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import { resultsApi, type MyInternals, type MyResults as Results } from '../api';

function Internals({ data }: { data: MyInternals }) {
  const withMarks = data.courses.filter((c) => c.assessments.length > 0);
  return (
    <Card className="print:hidden">
      <CardHeader title="Continuous assessment this semester" description={`${data.semester.label}. Shown once your lecturer shares them.`} />
      {withMarks.length === 0 ? (
        <EmptyState title="No marks shared yet" description="You will get an email and SMS when a lecturer shares marks." />
      ) : (
        <CardBody className="flex flex-col gap-4">
          {withMarks.map((c) => (
            <section key={c.offeringId}>
              <h3 className="text-sm font-medium">
                <span className="font-mono">{c.course.code}</span> {c.course.title}
              </h3>
              <ul className="mt-1 divide-y divide-border rounded-md border border-border">
                {c.assessments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      {a.name} <span className="text-xs text-muted">({a.weight}% of final mark)</span>
                    </span>
                    <span className="tabular-nums">
                      {a.absent ? 'Absent' : a.score === null ? 'Not recorded' : `${a.score} / ${a.maxScore}`}
                      {a.contribution !== null && <span className="ml-2 text-xs text-muted">{a.contribution} of {a.weight}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardBody>
      )}
    </Card>
  );
}

export function MyResults() {
  const me = useAuthStore((s) => s.me);
  const [results, setResults] = useState<Results | null>(null);
  const [internals, setInternals] = useState<MyInternals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resultsApi.myResults().then(setResults).catch((err) => setError(errorMessage(err)));
    resultsApi.myInternals().then(setInternals).catch(() => setInternals(null));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!results) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden print:block">
        <p className="text-lg font-bold">All Nations University</p>
        <p className="font-semibold">Statement of results (unofficial)</p>
        <p className="text-sm">
          {me && fullName(me)}, {me?.indexNumber}. Printed {formatDateTime(new Date())}. The official transcript is issued by the Registry.
        </p>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-xs text-muted">Cumulative GPA</p>
          <p className="text-3xl font-semibold tabular-nums">{results.cgpa?.toFixed(2) ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-xs text-muted">Credits passed</p>
          <p className="text-3xl font-semibold tabular-nums">{results.creditsPassed}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-xs text-muted">Credits graded</p>
          <p className="text-3xl font-semibold tabular-nums">{results.creditsAttempted}</p>
        </div>
      </section>

      {internals && <Internals data={internals} />}

      {results.semesters.length === 0 ? (
        <EmptyState title="No published results yet" description="Results appear here, with an email and SMS to you, once they are approved and published." />
      ) : (
        <>
          <div className="flex justify-end print:hidden">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print statement
            </Button>
          </div>
          {[...results.semesters].reverse().map((s) => (
            <Card key={s.id} className="break-inside-avoid">
              <CardHeader title={s.label} actions={<span className="text-sm">GPA <span className="font-semibold tabular-nums">{s.gpa?.toFixed(2) ?? '—'}</span></span>} />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">Course</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Credits</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Mark</th>
                      <th scope="col" className="px-4 py-2 font-medium">Grade</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {s.courses.map((c) => (
                      <tr key={c.code}>
                        <td className="px-4 py-2">
                          <span className="font-mono">{c.code}</span> {c.title}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.credits}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.incomplete ? '—' : c.total}</td>
                        <td className={cn('px-4 py-2 font-medium', c.incomplete ? 'text-warning' : !c.isPass && 'text-danger')}>{c.grade}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.incomplete ? '—' : c.gradePoint.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.courses.some((c) => c.incomplete) && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">IC means incomplete: you missed the exam. It is not counted in your GPA until resolved with your department.</p>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
