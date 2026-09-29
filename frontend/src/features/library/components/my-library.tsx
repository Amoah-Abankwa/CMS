'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatCedis } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import {
  byLine,
  dueLabel,
  FINE_REASON,
  libraryApi,
  type BorrowerSummary,
} from '../api';
import { CatalogueSearch } from './catalogue-search';
import { MyLibraryExtras } from './library-extras';
import { usePaymentReturn } from '@/features/fees/components/use-payment-return';

const TABS = [
  { value: 'loans', label: 'My books' },
  { value: 'find', label: 'Find a book' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'fines', label: 'Fines' },
] as const;

export function MyLibrary() {
  const [reloadKey, setReloadKey] = useState(0);

  const paymentNotice = usePaymentReturn(
    useCallback(() => setReloadKey((k) => k + 1), [])
  );

  const [data, setData] = useState<BorrowerSummary | null>(null);
  const [tab, setTab] =
    useState<(typeof TABS)[number]['value']>('loans');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const load = () =>
    libraryApi
      .mine()
      .then(setData)
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    void load();
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setError(null);
    setNotice(null);

    try {
      setNotice(await fn());
      await load();
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  }

  const ready = data.reservations.filter((r) => r.status === 'READY');

  return (
    <div className="flex flex-col gap-4">
      {paymentNotice && (
        <Alert tone={paymentNotice.tone}>{paymentNotice.text}</Alert>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <dt className="text-xs text-muted">Books out</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {data.loans.length}{' '}
            <span className="text-sm font-normal text-muted">
              of {data.rules.maxItems}
            </span>
          </dd>
        </div>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <dt className="text-xs text-muted">Loan length</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {data.rules.loanDays}{' '}
            <span className="text-sm font-normal text-muted">days</span>
          </dd>
        </div>

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <dt className="text-xs text-muted">Fines owed</dt>
          <dd
            className={cn(
              'text-2xl font-semibold tabular-nums',
              data.owed > 0 && 'text-danger'
            )}
          >
            {formatCedis(data.owed)}
          </dd>
        </div>
      </dl>

      {data.blocks.length > 0 && (
        <Alert
          tone="warning"
          title="You cannot borrow right now"
        >
          {data.blocks.join('. ')}.
        </Alert>
      )}

      {ready.map((r) => (
        <Alert key={r.id} tone="success" title="Ready to collect">
          &ldquo;{r.title.title}&rdquo; is waiting at the library desk until{' '}
          {r.expiresAt ? dueLabel(r.expiresAt) : 'soon'}.
        </Alert>
      ))}

      {notice && <Alert tone="success">{notice}</Alert>}

      {error && <Alert tone="danger">{error}</Alert>}

      <div
        role="tablist"
        aria-label="Library"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === t.value
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted hover:text-text'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'loans' &&
        (data.loans.length === 0 ? (
          <EmptyState
            title="No books out"
            description="Find a book and borrow it at the library desk with your ID."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {data.loans.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium">
                    {l.copy.title.title}
                  </span>

                  <span className="block text-xs text-muted">
                    {byLine(l.copy.title.authors)}. Copy {l.copy.barcode}.
                  </span>

                  <span
                    className={cn(
                      'block text-xs',
                      l.overdueDays
                        ? 'font-medium text-danger'
                        : 'text-muted'
                    )}
                  >
                    {l.overdueDays
                      ? `Overdue by ${l.overdueDays} days. Fine so far ${formatCedis(l.fineSoFar)}.`
                      : `Due ${dueLabel(l.dueAt)}.`}

                    {!l.canRenew && l.renewBlock
                      ? ` Cannot renew: ${l.renewBlock}`
                      : ''}
                  </span>
                </span>

                {l.canRenew && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === l.id}
                    onClick={() =>
                      act(l.id, async () => {
                        const r = await libraryApi.renew(l.id);

                        return `Renewed. Now due ${dueLabel(r.dueAt)}. ${r.renewalsLeft} renewals left.`;
                      })
                    }
                  >
                    Renew
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}

      {tab === 'find' && (
        <>
          <MyLibraryExtras />

          <CatalogueSearch
            refresh={refresh}
            action={(t) =>
              t.lendable > 0 && t.available === 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === t.id}
                  onClick={() =>
                    act(t.id, async () => {
                      const r = await libraryApi.reserve(t.id);

                      return `Reserved. You are number ${r.position} in the queue. We will email and text you when it is ready.`;
                    })
                  }
                >
                  Reserve
                </Button>
              ) : null
            }
          />
        </>
      )}

      {tab === 'reservations' &&
        (data.reservations.length === 0 ? (
          <EmptyState
            title="No reservations"
            description={`When every copy of a book is out, reserve it and we keep the next one for you for ${data.policy.holdDays} days.`}
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {data.reservations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>
                  {r.title.title}
                  <span className="block text-xs text-muted">
                    {r.status === 'READY'
                      ? `Ready at the desk until ${
                          r.expiresAt ? dueLabel(r.expiresAt) : ''
                        }`
                      : `Number ${r.position} in the queue`}
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  <Badge
                    tone={
                      r.status === 'READY' ? 'success' : 'primary'
                    }
                  >
                    {r.status === 'READY' ? 'Ready' : 'Waiting'}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy === r.id}
                    onClick={() =>
                      act(r.id, async () => {
                        await libraryApi.cancelReservation(r.id);
                        return 'Reservation cancelled.';
                      })
                    }
                  >
                    Cancel
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'fines' && (
        <Card>
          <CardHeader
            title="Fines"
            description={`Late books are fined ${formatCedis(
              data.policy.finePerDay
            )} a day. Pay online, or at the library desk. Borrowing stops when you owe ${formatCedis(
              data.policy.blockAtFines
            )} or more.`}
          />

          {data.fines.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">You owe nothing.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {data.fines.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
                >
                  <span>
                    {FINE_REASON[f.reason]}
                    {f.note ? `: ${f.note}` : ''}

                    {f.paid || f.waived ? (
                      <span className="block text-xs text-muted">
                        {formatCedis(f.amount)} charged,{' '}
                        {formatCedis(f.paid + f.waived)} paid or waived
                      </span>
                    ) : null}
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatCedis(f.outstanding)}
                    </span>

                    {f.outstanding > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          api
                            .post<{ paymentUrl: string }>(
                              `/me/library/fines/${f.id}/pay-online`
                            )
                            .then((r) => {
                              window.location.href =
                                r.data.paymentUrl;
                            })
                            .catch(() => undefined)
                        }
                      >
                        Pay online
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}