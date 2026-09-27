'use client';

import type { GroupSummary as Summary } from '../api';
import { cn } from '@/lib/cn';

/** One tile per user group. Choosing a tile filters the log to that group. */
export function GroupSummary({ summary, active, onSelect }: { summary: Summary; active?: string; onSelect: (group?: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
      {summary.groups.map((g) => {
        const selected = active === g.group;
        return (
          <button
            key={g.group}
            type="button"
            onClick={() => onSelect(selected ? undefined : g.group)}
            aria-pressed={selected}
            className={cn(
              'rounded-md border px-3 py-2.5 text-left hover:border-primary',
              selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
            )}
          >
            <span className="block text-xs text-muted">{g.label}</span>
            <span className="block text-lg font-semibold tabular-nums">{g.count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
