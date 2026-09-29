'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IMPORT_FIELDS, matchColumns, parseCsv, type ImportType } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/input';
import { EmptyState, Spinner } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/axios';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';

const TYPES: Array<{ type: ImportType; label: string; note: string }> = [
  { type: 'STRUCTURE', label: '1. Schools, departments and programmes', note: 'One row per programme, with its department and school. Programme types (Bachelor\u2019s, Diploma...) are set up under Programme types first.' },
  { type: 'COURSES', label: '2. Courses and curriculum', note: 'One row per course, or per course and programme to place it in a programme\u2019s curriculum.' },
  { type: 'STAFF', label: '3. Staff', note: 'Matched by email. Roles are added (never removed); Heads of Department, Deans and administrators are set on the Staff screens.' },
  { type: 'STUDENTS', label: '4. Students', note: 'Matched by index number; students keep their existing numbers. Graduated or withdrawn students are imported as deactivated.' },
  { type: 'RESULTS', label: '5. Past results', note: 'One row per student per course per semester, with the score, the grade, or both. They count towards CGPA and carry-overs. Never the current semester.' },
];
const CHUNK = 200;
type Result = { row: number; action: 'create' | 'update' | 'skip' | 'error'; messages: string[] };
interface Batch { id: string; type: ImportType; fileName: string; totalRows: number; created: number; updated: number; failed: number; createdAt: string; finishedAt: string | null; setupSentAt: string | null; awaitingSetup: number }

/** Importing records from the previous system: upload, match columns, check, import, send set-up links. */
export function DataImport() {
  const [type, setType] = useState<ImportType>('STRUCTURE');
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Result[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'checked' | 'importing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [history, setHistory] = useState<Batch[] | null>(null);
  const fields = IMPORT_FIELDS[type];
  const loadHistory = useCallback(() => { api.get<Batch[]>('/imports').then((r) => setHistory(r.data)).catch(() => setHistory([])); }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const reset = () => { setFile(null); setMap({}); setResults(null); setPhase('idle'); setProgress(0); setMsg(null); };
  const read = async (f: File) => {
    reset();
    if (f.size > 20 * 1024 * 1024) { setMsg({ tone: 'danger', text: 'The file is larger than 20 MB. Split it into smaller files.' }); return; }
    if (!/\.csv$/i.test(f.name)) { setMsg({ tone: 'danger', text: 'Choose a CSV file. In Excel: File, Save As, "CSV UTF-8".' }); return; }
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { setMsg({ tone: 'danger', text: 'The file has no rows under the headings.' }); return; }
    setFile({ name: f.name, headers: rows[0], rows: rows.slice(1) });
    setMap(matchColumns(type, rows[0]));
  };
  const missing = fields.filter((f) => f.required && map[f.key] === undefined);
  const records = useMemo(() => (file ? file.rows.map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i] ?? '']))) : []), [file, map]);

  const run = async (commit: boolean) => {
    if (!file) return;
    setPhase(commit ? 'importing' : 'checking');
    setMsg(null);
    setProgress(0);
    try {
      const batch = (await api.post<{ id: string }>('/imports', { type, fileName: file.name, totalRows: records.length })).data;
      const out: Result[] = [];
      for (let i = 0; i < records.length; i += CHUNK) {
        const r = (await api.post<Result[]>(`/imports/${batch.id}/rows`, { rows: records.slice(i, i + CHUNK), startRow: i + 2, commit })).data;
        out.push(...r);
        setProgress(Math.min(records.length, i + CHUNK));
      }
      if (commit) { await api.post(`/imports/${batch.id}/finish`); loadHistory(); }
      setResults(out);
      setPhase(commit ? 'done' : 'checked');
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) });
      setPhase(commit ? 'checked' : 'idle');
    }
  };
  const count = (a: Result['action']) => results?.filter((r) => r.action === a).length ?? 0;
  const problems = results?.filter((r) => r.action === 'error' || r.messages.length) ?? [];
  const report = () => downloadCsv(`import-report-${type.toLowerCase()}.csv`, [['Row', 'Outcome', 'Details'], ...problems.map((p) => [String(p.row), p.action === 'error' ? 'Not imported' : 'Imported with a note', p.messages.join(' ')])]);
  const template = () => downloadCsv(`template-${type.toLowerCase()}.csv`, [fields.map((f) => f.label)]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Import from the previous system" description="Save each list from the old system as a CSV file (in Excel: File, Save As, CSV UTF-8). Import in the order below: later lists refer to earlier ones. Nothing is saved until you choose Import, and running a corrected file again updates what is there." />
        <CardBody className="flex flex-col gap-3">
          <Field label="What are you importing?" htmlFor="im-t">
            <Select id="im-t" value={type} onChange={(e) => { setType(e.target.value as ImportType); reset(); }}>{TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</Select>
          </Field>
          <p className="text-sm text-muted">{TYPES.find((t) => t.type === type)!.note}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted">
              {file ? `Change file (${file.name})` : 'Choose CSV file'}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
            </label>
            <Button variant="ghost" size="sm" onClick={template}>Download a blank template</Button>
          </div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        </CardBody>
      </Card>

      {file && (
        <Card>
          <CardHeader title={`Match the columns (${file.rows.length} rows)`} description="Each of our fields is matched to a column in your file by its heading. Check them; required fields are marked." />
          <CardBody className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} htmlFor={`im-${f.key}`}>
                  <Select id={`im-${f.key}`} value={map[f.key] ?? ''} onChange={(e) => { const v = e.target.value; setMap((m) => { const n = { ...m }; if (v === '') delete n[f.key]; else n[f.key] = Number(v); return n; }); setResults(null); setPhase('idle'); }}>
                    <option value="">Not in my file</option>
                    {file.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {missing.length > 0 && <Alert tone="warning">Choose columns for: {missing.map((f) => f.label).join(', ')}.</Alert>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-xs">
                <thead><tr className="border-b border-border text-left text-muted">{fields.filter((f) => map[f.key] !== undefined).map((f) => <th key={f.key} className="px-2 py-1 font-medium">{f.label}</th>)}</tr></thead>
                <tbody>{records.slice(0, 5).map((r, i) => <tr key={i} className="border-b border-border">{fields.filter((f) => map[f.key] !== undefined).map((f) => <td key={f.key} className="px-2 py-1">{r[f.key]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={missing.length > 0 || phase === 'checking' || phase === 'importing'} loading={phase === 'checking'} onClick={() => run(false)}>Check every row</Button>
              {(phase === 'checked' || phase === 'importing') && <Button variant={count('error') ? 'secondary' : 'primary'} loading={phase === 'importing'} onClick={() => { if (!count('error') || window.confirm(`${count('error')} rows have errors and will be left out. Import the other ${count('create') + count('update')}?`)) void run(true); }}>Import</Button>}
              {(phase === 'checking' || phase === 'importing') && <span className="text-sm text-muted">{progress} of {records.length} rows...</span>}
            </div>
          </CardBody>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader title={phase === 'done' ? 'Imported' : 'Check finished: nothing saved yet'} description={`${count('create')} new, ${count('update')} to update, ${count('error')} with errors.`} actions={problems.length > 0 && <Button variant="secondary" size="sm" onClick={report}>Download the problems</Button>} />
          {problems.length === 0 ? <CardBody><p className="text-sm">Every row is fine.</p></CardBody> : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {problems.slice(0, 300).map((p) => <li key={p.row} className="flex gap-3 px-4 py-2 text-sm sm:px-5"><span className="w-16 shrink-0 text-muted">Row {p.row}</span><Badge tone={p.action === 'error' ? 'danger' : 'warning'}>{p.action === 'error' ? 'Error' : 'Note'}</Badge><span>{p.messages.join(' ')}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Imports so far" description="Imported staff and students have accounts waiting to be set up. Send them their set-up emails when you are ready; they go out a few at a time." />
        {!history ? <CardBody><Spinner /></CardBody> : history.length === 0 ? <CardBody><EmptyState title="Nothing imported yet" /></CardBody> : (
          <ul className="divide-y divide-border">
            {history.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span><span className="font-medium">{TYPES.find((t) => t.type === b.type)?.label.replace(/^\d\. /, '')}</span> <span className="text-muted">{b.fileName}, {formatDateTime(b.createdAt)}: {b.created} new, {b.updated} updated, {b.failed} with errors.</span></span>
                {b.awaitingSetup > 0 && <Button size="sm" variant="secondary" onClick={() => { if (window.confirm(`Email set-up links to ${b.awaitingSetup} accounts from this import?`)) api.post<{ queued: number; minutes: number }>(`/imports/${b.id}/setup-links`).then((r) => { setMsg({ tone: 'success', text: `${r.data.queued} set-up emails are on their way (about ${Math.max(1, r.data.minutes)} minutes).` }); loadHistory(); }).catch((err) => setMsg({ tone: 'danger', text: errorMessage(err) })); }}>{b.setupSentAt ? 'Send set-up emails again' : `Send ${b.awaitingSetup} set-up emails`}</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
