'use client';

import { useMemo } from 'react';
import { computeTotal, gradeFor, INCOMPLETE_GRADE, type Mark } from '@anu/shared';
import { fullName } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Workbook } from '../api';

export const cellKey = (assessmentId: string, studentId: string) => `${assessmentId}:${studentId}`;

/** Parses what the lecturer typed: a number, "ABS" for absent, or empty for not entered. */
export function parseCell(raw: string, max: number): { mark: Mark; error?: string } {
  const v = raw.trim();
  if (v === '') return { mark: { score: null, absent: false } };
  if (/^abs$/i.test(v)) return { mark: { score: null, absent: true } };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { mark: { score: null, absent: false }, error: 'Enter a number or ABS' };
  if (n > max) return { mark: { score: null, absent: false }, error: `Maximum is ${max}` };
  return { mark: { score: Math.round(n * 100) / 100, absent: false } };
}

interface Props {
  workbook: Workbook;
  cells: Record<string, string>;
  saved: Record<string, string>;
  onCell: (key: string, value: string) => void;
}

/**
 * Students down the side, assessments across the top. Totals and grades update as marks are typed,
 * using the same calculation the server uses on submit. Enter moves to the next student.
 */
export function MarksGrid({ workbook, cells, saved, onCell }: Props) {
  const { assessments, students, scale, canEdit } = workbook;

  const rows = useMemo(
    () =>
      students.map((s) => {
        const marks = new Map<string, Mark>();
        let hasError = false;
        for (const a of assessments) {
          const parsed = parseCell(cells[cellKey(a.id, s.id)] ?? '', a.maxScore);
          if (parsed.error) hasError = true;
          marks.set(a.id, parsed.mark);
        }
        const t = computeTotal(assessments, marks);
        const band = scale && !hasError ? gradeFor(t.total, scale.bands) : null;
        return { student: s, ...t, hasError, grade: t.incomplete ? INCOMPLETE_GRADE : band?.letter ?? '', isPass: band?.isPass ?? false };
      }),
    [students, assessments, cells, scale],
  );

  const focusNext = (col: number, row: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${col}-${row + 1}"]`);
    el?.focus();
    el?.select();
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 text-left font-medium">Student</th>
            {assessments.map((a) => (
              <th key={a.id} scope="col" className="border-b border-border px-2 py-2 text-left font-medium">
                <span className="block text-text">{a.name}</span>
                <span className="block font-normal">
                  {a.weight}%, out of {a.maxScore}
                </span>
              </th>
            ))}
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">CA</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">Exam</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">Total</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rowIndex) => (
            <tr key={r.student.id}>
              <th scope="row" className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-left font-normal">
                <span className="block font-mono text-xs">{r.student.indexNumber}</span>
                <span className="block max-w-44 truncate">{fullName(r.student)}</span>
              </th>
              {assessments.map((a, colIndex) => {
                const key = cellKey(a.id, r.student.id);
                const value = cells[key] ?? '';
                const { error } = parseCell(value, a.maxScore);
                const changed = value !== (saved[key] ?? '');
                return (
                  <td key={a.id} className="border-b border-border px-2 py-1.5">
                    <input
                      data-cell={`${colIndex}-${rowIndex}`}
                      aria-label={`${a.name} for ${r.student.indexNumber}`}
                      aria-invalid={!!error}
                      title={error}
                      disabled={!canEdit}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => onCell(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusNext(colIndex, rowIndex);
                        }
                      }}
                      className={cn(
                        'h-9 w-20 rounded border border-border bg-surface px-2 text-right tabular-nums disabled:opacity-70',
                        changed && 'border-primary bg-primary-soft',
                        error && 'border-danger bg-danger-soft',
                      )}
                    />
                  </td>
                );
              })}
              <td className="border-b border-border px-3 py-1.5 text-right tabular-nums text-muted">{r.caScore}</td>
              <td className="border-b border-border px-3 py-1.5 text-right tabular-nums text-muted">{r.examScore}</td>
              <td className="border-b border-border px-3 py-1.5 text-right font-medium tabular-nums">{r.hasError ? '' : r.total}</td>
              <td className={cn('border-b border-border px-3 py-1.5 font-medium', r.grade === INCOMPLETE_GRADE ? 'text-warning' : !r.isPass && r.grade ? 'text-danger' : '')}>
                {r.missing > 0 && !r.incomplete ? <span className="text-xs font-normal text-muted">{r.missing} missing</span> : r.grade}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
