import type { SheetSummary } from '../api';

/** Horizontal bars, one per grade, so an approver can spot an unusual spread at a glance. */
export function GradeDistribution({ summary, order }: { summary: SheetSummary; order: string[] }) {
  const grades = [...order.filter((g) => summary.distribution[g] !== undefined), ...Object.keys(summary.distribution).filter((g) => !order.includes(g))];
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
      <dl className="grid shrink-0 grid-cols-3 gap-4 sm:grid-cols-1">
        <div>
          <dt className="text-xs text-muted">Students</dt>
          <dd className="text-xl font-semibold tabular-nums">{summary.students}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pass rate</dt>
          <dd className="text-xl font-semibold tabular-nums">{summary.passRate === null ? '—' : `${summary.passRate}%`}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average total</dt>
          <dd className="text-xl font-semibold tabular-nums">{summary.mean ?? '—'}</dd>
        </div>
      </dl>
      <ul className="flex flex-1 flex-col gap-1.5" aria-label="Number of students per grade">
        {grades.map((g) => (
          <li key={g} className="flex items-center gap-2 text-sm">
            <span className="w-8 shrink-0 font-medium">{g}</span>
            <span className="h-4 flex-1 rounded-sm bg-surface-muted">
              <span className="block h-4 rounded-sm bg-primary" style={{ width: `${(summary.distribution[g] / max) * 100}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted">{summary.distribution[g]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
