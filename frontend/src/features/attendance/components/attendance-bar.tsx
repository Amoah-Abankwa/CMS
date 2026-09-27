import { cn } from '@/lib/cn';

/** A percentage bar with a marker at the minimum, so distance from the line is visible at a glance. */
export function AttendanceBar({ percent, minimum }: { percent: number | null; minimum: number }) {
  if (percent === null) return <span className="text-xs text-muted">No classes recorded</span>;
  const below = percent < minimum;
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-2 w-24 rounded-sm bg-surface-muted" aria-hidden>
        <span className={cn('absolute inset-y-0 left-0 rounded-sm', below ? 'bg-danger' : 'bg-success')} style={{ width: `${percent}%` }} />
        <span className="absolute -inset-y-0.5 w-px bg-text" style={{ left: `${minimum}%` }} />
      </span>
      <span className={cn('text-sm tabular-nums', below && 'font-medium text-danger')}>{percent}%</span>
    </span>
  );
}
