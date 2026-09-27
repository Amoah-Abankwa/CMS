'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { validateScale } from '@anu/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { formatDateTime } from '@/lib/format';
import { resultsApi, type GradingScale } from '../api';

interface Row {
  letter: string;
  minScore: string;
  gradePoint: string;
  remark: string;
}

const toRows = (s: GradingScale): Row[] =>
  s.bands.map((b) => ({ letter: b.letter, minScore: String(b.minScore), gradePoint: String(b.gradePoint), remark: b.remark ?? '' }));

/**
 * Edit grade bands. Pass or fail follows from the pass mark, so it cannot contradict it.
 * Saving creates a new version; results already published keep their grades.
 */
export function GradingScaleEditor() {
  const [scale, setScale] = useState<GradingScale | null>(null);
  const [name, setName] = useState('');
  const [passMark, setPassMark] = useState('50');
  const [maxPoint, setMaxPoint] = useState('4');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (s: GradingScale) => {
    setScale(s);
    setName(s.name);
    setPassMark(String(s.passMark));
    setMaxPoint(String(s.maxGradePoint));
    setRows(toRows(s));
  };

  useEffect(() => {
    resultsApi.scale().then(load).catch((err) => setError(errorMessage(err)));
  }, []);

  const bands = useMemo(
    () =>
      rows.map((r) => ({
        letter: r.letter.trim().toUpperCase(),
        minScore: Number(r.minScore),
        gradePoint: Number(r.gradePoint),
        isPass: Number(r.minScore) >= Number(passMark),
        remark: r.remark.trim() || undefined,
      })),
    [rows, passMark],
  );
  const problems = useMemo(() => validateScale(bands, Number(passMark), Number(maxPoint)), [bands, passMark, maxPoint]);
  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);

  const update = (i: number, key: keyof Row, value: string) => {
    setSaved(false);
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      load(await resultsApi.saveScale({ name: name.trim(), passMark: Number(passMark), maxGradePoint: Number(maxPoint), bands }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!scale && !error) return <Spinner />;
  if (!scale) return <Alert tone="danger">{error}</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Version {scale.version}, saved {formatDateTime(scale.createdAt)}. Saving creates version {scale.version + 1}. Results already published keep the grades they were given; results submitted from now on use the new scale.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Grading scale saved.</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Scale name" htmlFor="scale-name">
          <Input id="scale-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="Pass mark" htmlFor="pass-mark" hint="Totals at or above this pass.">
          <Input id="pass-mark" type="number" inputMode="decimal" value={passMark} onChange={(e) => { setPassMark(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="Highest grade point" htmlFor="max-point">
          <Input id="max-point" type="number" inputMode="decimal" step="0.5" value={maxPoint} onChange={(e) => { setMaxPoint(e.target.value); setSaved(false); }} />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Grade</th>
              <th scope="col" className="px-3 py-2 font-medium">From score</th>
              <th scope="col" className="px-3 py-2 font-medium">Grade point</th>
              <th scope="col" className="px-3 py-2 font-medium">Remark</th>
              <th scope="col" className="px-3 py-2 font-medium">Result</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5"><Input aria-label="Grade letter" className="h-9 w-16 uppercase" value={r.letter} maxLength={3} onChange={(e) => update(i, 'letter', e.target.value)} /></td>
                <td className="px-3 py-1.5"><Input aria-label="From score" className="h-9 w-20" type="number" inputMode="decimal" value={r.minScore} onChange={(e) => update(i, 'minScore', e.target.value)} /></td>
                <td className="px-3 py-1.5"><Input aria-label="Grade point" className="h-9 w-20" type="number" inputMode="decimal" step="0.5" value={r.gradePoint} onChange={(e) => update(i, 'gradePoint', e.target.value)} /></td>
                <td className="px-3 py-1.5"><Input aria-label="Remark" className="h-9" value={r.remark} maxLength={40} onChange={(e) => update(i, 'remark', e.target.value)} /></td>
                <td className="px-3 py-1.5 text-xs">{Number(r.minScore) >= Number(passMark) ? 'Pass' : 'Fail'}</td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded text-muted hover:bg-surface-muted" aria-label={`Remove grade ${r.letter}`}>
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { letter: '', minScore: '', gradePoint: '', remark: '' }])}>
          <Plus className="size-4" aria-hidden /> Add grade
        </Button>
      </div>

      <section aria-label="Preview" className="rounded-md border border-border bg-surface-muted px-4 py-3">
        <p className="mb-2 text-sm font-medium">How totals will be graded</p>
        {problems.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-danger">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {sorted.map((b, i) => (
              <li key={b.letter} className="tabular-nums">
                {b.minScore} to {i === 0 ? 100 : sorted[i - 1].minScore - 1}: <span className="font-medium">{b.letter}</span>, {b.gradePoint.toFixed(1)} points, {b.isPass ? 'pass' : 'fail'}
              </li>
            ))}
            <li>Absent from an exam: <span className="font-medium">IC</span> (incomplete), left out of the GPA</li>
          </ul>
        )}
      </section>

      <div>
        <Button onClick={save} loading={busy} disabled={problems.length > 0 || !name.trim()}>
          Save as version {scale.version + 1}
        </Button>
      </div>
    </div>
  );
}
