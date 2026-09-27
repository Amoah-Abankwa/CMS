'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { byLine, libraryApi, type TitleRow } from '../api';

const PAGE_SIZE = 20;

/**
 * Search by any part of the title, author, ISBN, call number or subject.
 * `action` renders a button per result (reserve for borrowers); `manageHref` links to the librarian's page instead.
 */
export function CatalogueSearch({ action, manageHref, refresh = 0 }: { action?: (t: TitleRow) => React.ReactNode; manageHref?: (t: TitleRow) => string; refresh?: number }) {
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: TitleRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => libraryApi.search({ search: search.trim() || undefined, availableOnly: available, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))), [search, available, page]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(id);
  }, [load, refresh]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input type="search" aria-label="Search the catalogue" placeholder="Title, author, ISBN or subject" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="sm:max-w-md" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={available} onChange={(e) => { setAvailable(e.target.checked); setPage(1); }} /> On the shelf now</label>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No books match" description="Try fewer words, or part of the author's surname." /> : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 text-sm">
                  {manageHref ? <Link href={manageHref(t)} className="font-medium text-primary hover:underline">{t.title}</Link> : <span className="font-medium">{t.title}</span>}
                  {t.subtitle && <span className="text-muted">: {t.subtitle}</span>}
                  <span className="block text-xs text-muted">
                    {byLine(t.authors)}{t.edition ? `, ${t.edition}` : ''}{t.year ? `, ${t.year}` : ''}. {t.callNumber ?? ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {t.lendable === 0 ? <Badge>Reference only</Badge> : <Badge tone={t.available ? 'success' : 'warning'}>{t.available ? `${t.available} of ${t.lendable} on the shelf` : 'All out'}</Badge>}
                  {t.waiting > 0 && <Badge>{t.waiting} waiting</Badge>}
                  {action?.(t)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3"><Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}
