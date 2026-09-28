'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCedis, formatMoney } from '@anu/shared';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/states';
import { resultsApi, type MyResults } from '@/features/results/api';
import { feesApi, type MyBill, type MyDues } from '@/features/fees/api';

/** A student's standing at a glance: CGPA, fees and compulsory dues. Each part loads on its own. */
export function StudentStanding() {
  const [results, setResults] = useState<MyResults | null | undefined>(undefined);
  const [bill, setBill] = useState<MyBill | null | undefined>(undefined);
  const [dues, setDues] = useState<MyDues | null | undefined>(undefined);
  useEffect(() => {
    resultsApi.myResults().then(setResults).catch(() => setResults(null));
    feesApi.mine().then((d) => setBill(d.bills[0] ?? null)).catch(() => setBill(null));
    feesApi.myDues().then(setDues).catch(() => setDues(null));
  }, []);

  const lastSemester = results?.semesters?.at(-1);
  const unpaidDues = dues?.levies.filter((l) => !l.payment) ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader title="CGPA" />
        <CardBody>
          {results === undefined ? <Spinner /> : !results || results.cgpa === null ? (
            <p className="text-sm text-muted">No published results yet.</p>
          ) : (
            <>
              <p className="text-3xl font-semibold tabular-nums">{results.cgpa.toFixed(2)}</p>
              <p className="text-sm text-muted">{lastSemester ? `${lastSemester.label}: GPA ${lastSemester.gpa?.toFixed(2) ?? '-'}. ` : ''}{results.creditsPassed} credits passed.</p>
              <Link href="/results" className="mt-1 inline-block text-sm text-primary hover:underline">All results</Link>
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Fees" />
        <CardBody>
          {bill === undefined ? <Spinner /> : !bill ? <p className="text-sm text-muted">No bill yet this semester.</p> : (
            <>
              <p className="text-3xl font-semibold tabular-nums">{formatMoney(Math.max(0, bill.balance), bill.currency)}</p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">Balance for {bill.semesterLabel}. {bill.cleared ? <Badge tone="success">Cleared for exams</Badge> : <Badge tone="warning">{bill.percentPaid}% paid</Badge>}</p>
              <Link href="/fees" className="mt-1 inline-block text-sm text-primary hover:underline">Pay, statement and receipts</Link>
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Departmental dues" />
        <CardBody>
          {dues === undefined ? <Spinner /> : !dues || !dues.associations.length ? <p className="text-sm text-muted">No association for your department.</p> : unpaidDues.length === 0 ? (
            <p className="text-sm">All paid. <Link href="/dues" className="text-primary hover:underline">Receipts</Link></p>
          ) : (
            <>
              <p className="text-3xl font-semibold tabular-nums">{formatCedis(unpaidDues.reduce((t, l) => t + l.amount, 0))}</p>
              <p className="text-sm text-muted">Compulsory dues outstanding: {unpaidDues.map((l) => `${l.association.code} ${l.title}`).join(', ')}.</p>
              <Link href="/dues" className="mt-1 inline-block text-sm text-primary hover:underline">Pay dues</Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
