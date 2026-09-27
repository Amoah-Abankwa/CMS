'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { downloadCsv as saveCsv } from '@/lib/csv';
import { accommodationApi, RESIDENCE_LABEL, type ResidenceRow } from '../api';

const PAGE_SIZE = 50;
const TONE = { UNIVERSITY: 'success', PRIVATE: 'primary', OFF_CAMPUS: 'neutral', UNKNOWN: 'warning' } as const;

export function ResidenceOverview() {
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof accommodationApi.residence>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => accommodationApi.residence({ kind: kind || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))), [kind, search, page]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const download = async () => {
    const rows: ResidenceRow[] = [];
    for (let p = 1; ; p++) {
      const d = await accommodationApi.residence({ kind: kind || undefined, page: p, pageSize: 100 });
      rows.push(...d.items);
      if (p * 100 >= d.total) break;
    }
    const csv = [['Index number', 'Name', 'Phone', 'Programme', 'Level', 'Lives', 'Where'], ...rows.map((r) => [r.indexNumber, `${r.firstName} ${r.lastName}`, r.phone, r.programme, r.level, RESIDENCE_LABEL[r.kind], r.where])];
    saveCsv('where-students-live.csv', csv);
  };

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{data.semester.label}. Students with approved courses this semester.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(RESIDENCE_LABEL) as Array<keyof typeof RESIDENCE_LABEL>).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(kind === k ? '' : k); setPage(1); }} aria-pressed={kind === k}
            className={`rounded-lg border px-4 py-3 text-left ${kind === k ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <dt className="text-xs text-muted">{RESIDENCE_LABEL[k]}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{data.counts[k] ?? 0}</dd>
          </button>
        ))}
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-3 sm:max-w-lg sm:grid-cols-2">
          <Select aria-label="Filter" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            {(Object.keys(RESIDENCE_LABEL) as Array<keyof typeof RESIDENCE_LABEL>).map((k) => <option key={k} value={k}>{RESIDENCE_LABEL[k]}</option>)}
          </Select>
          <Input type="search" aria-label="Search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button variant="secondary" size="sm" onClick={download}><Download className="size-4" aria-hidden /> Download CSV</Button>
      </div>
      {data.items.length === 0 ? <EmptyState title="No students match" /> : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <span className="font-mono text-xs text-muted">{r.indexNumber}</span> {r.firstName} {r.lastName}
                  <span className="block text-xs text-muted">{r.where ?? 'Has not said where they live'}{r.phone ? `. ${r.phone}` : ''}</span>
                </span>
                <Badge tone={TONE[r.kind]}>{RESIDENCE_LABEL[r.kind]}</Badge>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3"><Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}
