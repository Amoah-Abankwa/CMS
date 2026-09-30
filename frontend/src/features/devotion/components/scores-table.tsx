'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { PERMISSIONS } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { downloadCsv as saveCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useSemesters } from '@/features/academics/use-semesters';
import { SemesterSelect } from '@/features/academics/components/semester-select';
import { devotionApi, marks, type ScoresView } from '../api';

const PAGE_SIZE = 30;

export function ScoresTable() {
  const canManage = useAuthStore((s) => s.can(PERMISSIONS.DEVOTION_MANAGE));
  const { semesters } = useSemesters();
  const [semesterId, setSemesterId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ScoresView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => devotionApi.scores({ semesterId: semesterId || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err))),
    [semesterId, search, page],
  );
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  /** Downloads every student, not just this page, for the Registry. */
  const download = async () => {
    // The server returns at most 100 per page, so collect every page.
    const first = await devotionApi.scores({ semesterId: data?.semester.id, page: 1, pageSize: 100 });
    const all = { ...first, items: [...first.items] };
    for (let p = 2; (p - 1) * 100 < first.total; p++) {
      all.items.push(...(await devotionApi.scores({ semesterId: data?.semester.id, page: p, pageSize: 100 })).items);
    }
    const rows = [
      ['Index number', 'Name', 'Programme', 'Early', 'Late', 'Absent', 'Excused', `Score out of ${all.policy.totalMarks.toFixed(2)}`, 'Final score'],
      ...all.items.map((r) => [r.indexNumber, `${r.firstName} ${r.lastName}`, r.studentProfile?.programme.name, r.early, r.late, r.absent, r.excused, marks(r.score), marks(r.finalScore)]),
    ];
    saveCsv(`devotion-scores-${all.semester.label.replace(/[^\w]+/g, '-')}.csv`, rows);
  };

  const finalise = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await devotionApi.finalise(data?.semester.id);
      setNotice(`Scores finalised for ${r.students} students. ${r.notified} notified by email, SMS and in-app.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  if (error && !data) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <Spinner />;
  const total = data.policy.totalMarks;

  return (
    <div className="flex flex-col gap-4">
      {semesters && <div className="max-w-sm"><SemesterSelect semesters={semesters} value={semesterId} onChangeAction={(v) => { setSemesterId(v); setPage(1); }} /></div>}
      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3"><dt className="text-xs text-muted">Students</dt><dd className="text-2xl font-semibold tabular-nums">{data.stats.students}</dd></div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3"><dt className="text-xs text-muted">Average</dt><dd className="text-2xl font-semibold tabular-nums">{marks(data.stats.average)}</dd></div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3"><dt className="text-xs text-muted">Full {total.toFixed(2)}</dt><dd className="text-2xl font-semibold tabular-nums">{data.stats.full}</dd></div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-72">
          <label htmlFor="score-search" className="sr-only">Search</label>
          <Input id="score-search" type="search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={download}><Download className="size-4" aria-hidden /> Download CSV</Button>
          {canManage && <Button size="sm" onClick={() => setConfirm(true)}>{data.finalizedAt ? 'Finalise again' : 'Finalise semester scores'}</Button>}
        </div>
      </div>
      <p className="text-xs text-muted">Lowest scores first. {data.finalizedAt ? `Last finalised ${formatDateTime(data.finalizedAt)}.` : 'Not finalised yet; scores are running totals.'}</p>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {data.items.length === 0 ? (
        <EmptyState title="No students found" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Student</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Early</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Late</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Absent</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Excused</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Score / {total.toFixed(2)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2"><span className="font-mono text-xs text-muted">{r.indexNumber}</span> {r.firstName} {r.lastName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.early}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.late}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.absent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.excused}</td>
                  <td className={cn('px-4 py-2 text-right font-medium tabular-nums', r.score !== null && r.score < total / 2 && 'text-danger')}>
                    {marks(r.finalScore ?? r.score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Finalise devotion scores?" description={data.semester.label}>
        <div className="flex flex-col gap-4">
          <p className="text-sm">Each student&rsquo;s score out of {total.toFixed(2)} is fixed and sent to them. You can finalise again after corrections; then only students whose score changed are told.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button loading={busy} onClick={finalise}>Finalise scores</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
