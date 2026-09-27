'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { downloadCsv } from '@/lib/csv';
import { feesApi, type FeeOptions } from '../api';

export function FeeBills() {
  const [opts, setOpts] = useState<FeeOptions | null>(null);
  const [q, setQ] = useState({ semesterId: '', search: '', status: '', page: 1 });
  const [data, setData] = useState<Awaited<ReturnType<typeof feesApi.bills>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { feesApi.options().then((o) => { setOpts(o); setQ((x) => ({ ...x, semesterId: o.semesters.find((s) => s.isCurrent)?.id ?? '' })); }).catch((err) => setError(errorMessage(err))); }, []);
  const load = useCallback(() => { if (opts) feesApi.bills({ ...q, semesterId: q.semesterId || undefined, search: q.search || undefined, status: q.status || undefined }).then(setData).catch((err) => setError(errorMessage(err))); }, [q, opts]);
  useEffect(() => { const t = window.setTimeout(load, 250); return () => window.clearTimeout(t); }, [load]);

  const exportAll = async () => {
    const all = await feesApi.bills({ semesterId: q.semesterId || undefined, status: q.status || undefined, search: q.search || undefined, page: 1 });
    const rows = [...all.items];
    for (let page = 2; (page - 1) * all.pageSize < all.total; page++) rows.push(...(await feesApi.bills({ semesterId: q.semesterId || undefined, status: q.status || undefined, search: q.search || undefined, page })).items);
    downloadCsv('student-fees.csv', [['Index number', 'Name', 'Programme', 'Level', 'Due (GHS)', 'Paid (GHS)', 'Balance (GHS)', 'Paid %', 'Cleared'],
      ...rows.map((b) => [b.student.indexNumber, `${b.student.firstName} ${b.student.lastName}`, b.student.studentProfile?.programme.name, b.student.studentProfile?.currentLevel, b.due / 100, (b.due - Math.max(0, b.balance)) / 100, Math.max(0, b.balance) / 100, b.percentPaid, b.clearance?.cleared ? 'Yes' : 'No'])]);
  };

  if (!opts) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Bills', String(data.summary.bills)], ['Due', formatCedis(data.summary.due)], ['Collected', formatCedis(data.summary.collected)], [`Cleared (${data.clearancePercent}% rule)`, String(data.summary.cleared)]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-border bg-surface px-4 py-3"><p className="text-xs text-muted">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
          ))}
        </div>
      )}
      <Card>
        <CardHeader title="Student bills" actions={data && data.total > 0 ? <Button variant="secondary" size="sm" onClick={exportAll}>Download CSV</Button> : undefined} />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Select aria-label="Semester" value={q.semesterId} onChange={(e) => setQ({ ...q, semesterId: e.target.value, page: 1 })}>{opts.semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          <Input aria-label="Search" placeholder="Index number or name" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value, page: 1 })} />
          <Select aria-label="Show" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value, page: 1 })}>
            <option value="">Everyone</option><option value="UNPAID">Nothing paid</option><option value="PART">Part paid</option><option value="PAID">Fully paid</option><option value="CLEARED">Cleared for exams</option>
          </Select>
        </CardBody>
        {!data ? <CardBody><Spinner /></CardBody> : data.items.length === 0 ? <CardBody><EmptyState title="No bills" description="Issue bills from Fee set-up." /></CardBody> : (
          <>
            <ul className="divide-y divide-border border-t border-border">
              {data.items.map((b) => (
                <li key={b.id}>
                  <Link href={`/finance/fees/${b.id}`} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <span className="text-sm"><span className="font-medium">{b.student.firstName} {b.student.lastName}</span> <span className="text-muted">{b.student.indexNumber}</span></span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums">{formatCedis(Math.max(0, b.balance))} owed</span>
                      <Badge tone={b.clearance?.cleared ? 'success' : b.percentPaid > 0 ? 'warning' : 'neutral'}>{b.clearance?.cleared ? 'Cleared' : `${b.percentPaid}%`}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(page) => setQ({ ...q, page })} /></div>
          </>
        )}
      </Card>
    </div>
  );
}
