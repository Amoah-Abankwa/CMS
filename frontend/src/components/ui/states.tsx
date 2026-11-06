import type { ReactNode } from 'react';

/** A grey placeholder shaped like the content that is loading. Still for people who prefer less motion. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none ${className}`} aria-hidden />;
}

/**
 * Shown while a page or card loads: a few skeleton lines in place of the content. (Named Spinner
 * because every screen already uses it; screen readers still hear the label.)
 */
export function Spinner({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  const widths = ['w-11/12', 'w-4/5', 'w-2/3', 'w-3/4', 'w-1/2'];
  return (
    <div className="flex flex-col gap-3 py-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-4 ${widths[i % widths.length]}`} />)}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
