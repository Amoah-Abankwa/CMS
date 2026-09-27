'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { downloadCsv as saveCsv } from '@/lib/csv';
import { dueLabel, libraryApi, type HoldRow, type OverdueRow } from '../api';

type Stats = Awaited<ReturnType<typeof libraryApi.stats>>;

export function OverdueAndHolds() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [overdue, setOverdue] = useState<OverdueRow[] | null>(null);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    libraryApi.stats().then(setStats).catch((err) => setError(errorMessage(err)));
    libraryApi.overdue().then(setOverdue).catch((err) => setError(errorMessage(err)));
    libraryApi.holds().then(setHolds).catch(() => setHolds([]));
  }, []);

  const download = () => {
    if (!overdue) return;
    const rows = [['Borrower', 'Index or email', 'Phone', 'Title', 'Barcode', 'Due', 'Days overdue', 'Fine so far (GH₵)'],
      ...overdue.map((o) => [`${o.borrower.firstName} ${o.borrower.lastName}`, o.borrower.indexNumber ?? o.borrower.email, o.borrower.phone, o.copy.title.title, o.copy.barcode, dueLabel(o.dueAt), o.days, (o.fineSoFar / 100).toFixed(2)])];
    saveCsv('overdue-books.csv', rows);
  };

  if (error && !stats) return <Alert tone="danger">{error}</Alert>;
  if (!stats || !overdue) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Titles', stats.titles], ['Copies', stats.copies], ['On loan', stats.onLoan], ['Overdue', stats.overdue], ['Reserved, waiting', stats.waiting], ['Ready to collect', stats.ready], ['Fines owed', formatCedis(stats.finesOwed)]].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-border bg-surface px-4 py-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>

      <Card>
        <CardHeader title="Reservations shelf" description="Copies kept for someone. Uncollected ones pass to the next person automatically." />
        {holds.length === 0 ? <EmptyState title="Nothing waiting to be collected" /> : (
          <ul className="divide-y divide-border">
            {holds.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>{h.title.title} <span className="font-mono text-xs text-muted">{h.copy?.barcode}</span><span className="block text-xs text-muted">For {h.borrower.firstName} {h.borrower.lastName} ({h.borrower.indexNumber ?? h.borrower.email})</span></span>
                <span className="text-xs text-muted">Until {dueLabel(h.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={`Overdue books (${overdue.length})`} description="Borrowers are reminded automatically: the day after the due date, then weekly, up to three times." actions={overdue.length ? <Button variant="secondary" size="sm" onClick={download}><Download className="size-4" aria-hidden /> Download CSV</Button> : undefined} />
        {overdue.length === 0 ? <EmptyState title="Nothing overdue" /> : (
          <ul className="divide-y divide-border">
            {overdue.map((o) => (
              <li key={o.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0 text-sm">
                  {o.copy.title.title} <span className="font-mono text-xs text-muted">{o.copy.barcode}</span>
                  <span className="block text-xs text-muted">{o.borrower.firstName} {o.borrower.lastName}, {o.borrower.indexNumber ?? o.borrower.email}{o.borrower.phone ? `, ${o.borrower.phone}` : ''}. Due {dueLabel(o.dueAt)}. {o.overdueNoticeCount} reminders sent.</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-danger">{o.days} days, {formatCedis(o.fineSoFar)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
