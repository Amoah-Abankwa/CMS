'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { errorMessage } from '@/lib/axios';
import { resultsApi, type AssessmentComponent, type Workbook } from '../api';

/** Lead lecturer sets the assessments and their weights. Weights must total 100%. */
export function SchemeEditor({ workbook, onSaved, onCancel }: { workbook: Workbook; onSaved: (w: Workbook) => void; onCancel?: () => void }) {
  const initial = workbook.assessments.length ? workbook.assessments : workbook.suggestedScheme ?? [];
  const [rows, setRows] = useState<AssessmentComponent[]>(initial.map((a) => ({ ...a })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = Math.round(rows.reduce((s, r) => s + (Number(r.weight) || 0), 0) * 100) / 100;
  const ca = rows.filter((r) => r.kind === 'CONTINUOUS').reduce((s, r) => s + (Number(r.weight) || 0), 0);

  const set = (i: number, patch: Partial<AssessmentComponent>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await resultsApi.saveScheme(workbook.offering.id, rows.map((r) => ({ ...r, weight: Number(r.weight), maxScore: Number(r.maxScore) }))));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {workbook.suggestedScheme && (
        <Alert tone="info" title="Set up how this course is assessed">
          This is a suggested breakdown. Rename, reweight or add assessments to match your course outline, then save.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="py-2 pr-2 font-medium">Assessment</th>
              <th scope="col" className="px-2 py-2 font-medium">Type</th>
              <th scope="col" className="px-2 py-2 font-medium">Weight (%)</th>
              <th scope="col" className="px-2 py-2 font-medium">Marked out of</th>
              <th scope="col" className="py-2 pl-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? `new-${i}`}>
                <td className="py-1 pr-2"><Input aria-label="Assessment name" className="h-9" value={r.name} maxLength={60} onChange={(e) => set(i, { name: e.target.value })} /></td>
                <td className="px-2 py-1">
                  <Select aria-label="Assessment type" className="h-9" value={r.kind} onChange={(e) => set(i, { kind: e.target.value as AssessmentComponent['kind'] })}>
                    <option value="CONTINUOUS">Continuous assessment</option>
                    <option value="EXAM">Examination</option>
                  </Select>
                </td>
                <td className="px-2 py-1"><Input aria-label="Weight" className="h-9 w-24" type="number" inputMode="decimal" value={r.weight} onChange={(e) => set(i, { weight: e.target.value as unknown as number })} /></td>
                <td className="px-2 py-1"><Input aria-label="Marked out of" className="h-9 w-24" type="number" inputMode="decimal" value={r.maxScore} onChange={(e) => set(i, { maxScore: e.target.value as unknown as number })} /></td>
                <td className="py-1 pl-2">
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded text-muted hover:bg-surface-muted" aria-label={`Remove ${r.name}`}>
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { name: '', kind: 'CONTINUOUS', weight: 0, maxScore: 100 }])} disabled={rows.length >= 10}>
          <Plus className="size-4" aria-hidden /> Add assessment
        </Button>
        <p className="text-sm">
          <Badge tone={total === 100 ? 'success' : 'danger'}>Total {total}%</Badge>{' '}
          <span className="text-muted">Continuous assessment {ca}%, examination {Math.round((total - ca) * 100) / 100}%</span>
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} loading={busy} disabled={total !== 100 || rows.some((r) => !r.name.trim())}>
          Save assessments
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
