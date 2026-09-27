'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime, fullName } from '@/lib/format';
import { examsApi, type ClearanceView } from '../api';

const PAGE_SIZE = 25;

/** Finance Office: who is cleared to sit exams this semester. */
export function ClearanceManager() {
  const [status, setStatus] = useState('NOT_CLEARED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ClearanceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(
    () => examsApi.clearance({ status: status || undefined, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }).then(setView).catch((err) => setError(errorMessage(err))),
    [status, search, page],
  );
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const toggle = async (indexNumber: string, cleared: boolean) => {
    setBusyId(indexNumber);
    setError(null);
    try {
      await examsApi.setClearance([indexNumber], cleared, cleared ? 'Cleared' : 'Clearance withdrawn');
      setNotice(`${indexNumber} ${cleared ? 'cleared' : 'marked as not cleared'}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const bulk = async () => {
    const numbers = bulkText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!numbers.length) return;
    setBulkBusy(true);
    setError(null);
    try {
      const r = await examsApi.setClearance(numbers, true, bulkNote.trim() || undefined);
      setNotice(`${r.updated} students cleared.${r.notFound.length ? ` Not found: ${r.notFound.join(', ')}.` : ''}`);
      setBulkOpen(false);
      setBulkText('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  };

  if (error && !view) return <Alert tone="danger">{error}</Alert>;
  if (!view) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{view.semester.label}. Students with approved courses: {view.counts.students}. Cleared: {view.counts.cleared}. Not cleared: {view.counts.notCleared}.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-3 sm:max-w-lg sm:grid-cols-2">
          <div>
            <label htmlFor="clr-status" className="sr-only">Status</label>
            <Select id="clr-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="NOT_CLEARED">Not cleared</option>
              <option value="CLEARED">Cleared</option>
              <option value="">Everyone</option>
            </Select>
          </div>
          <div>
            <label htmlFor="clr-search" className="sr-only">Search</label>
            <Input id="clr-search" type="search" placeholder="Search name or index number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <Button size="sm" onClick={() => setBulkOpen(true)}>Clear a list of students</Button>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {view.items.length === 0 ? (
        <EmptyState title={status === 'NOT_CLEARED' ? 'Everyone is cleared' : 'No students match'} />
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {view.items.map((s) => {
              const cleared = !!s.clearance?.cleared;
              return (
                <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{fullName(s)}</span> <span className="font-mono text-xs text-muted">{s.indexNumber}</span>
                    <span className="block text-xs text-muted">
                      {s.studentProfile?.programme.name}, level {s.studentProfile?.currentLevel}.
                      {s.clearance ? ` Updated ${formatDateTime(s.clearance.updatedAt)}${s.clearance.note ? `: ${s.clearance.note}` : ''}.` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={cleared ? 'success' : 'warning'}>{cleared ? 'Cleared' : 'Not cleared'}</Badge>
                    <Button variant="secondary" size="sm" loading={busyId === s.indexNumber} onClick={() => toggle(s.indexNumber, !cleared)}>
                      {cleared ? 'Withdraw' : 'Clear'}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} pageSize={PAGE_SIZE} total={view.total} onChange={setPage} />
          </div>
        </div>
      )}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} title="Clear a list of students" description="Paste index numbers from your records, one per line or separated by commas.">
        <div className="flex flex-col gap-4">
          <Field label="Index numbers" htmlFor="bulk-list">
            <Textarea id="bulk-list" className="min-h-40 font-mono" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'ANU26400001\nANU26400002'} />
          </Field>
          <Field label="Note (optional)" htmlFor="bulk-note">
            <Input id="bulk-note" value={bulkNote} maxLength={200} onChange={(e) => setBulkNote(e.target.value)} placeholder="Receipts checked 20 November" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button loading={bulkBusy} onClick={bulk} disabled={!bulkText.trim()}>Clear these students</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
