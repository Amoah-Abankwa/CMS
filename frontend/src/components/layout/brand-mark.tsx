import { cn } from '@/lib/cn';

export function BrandMark({ showName = true, className }: { showName?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold tracking-wide text-primary-fg" aria-hidden>
        ANU
      </span>
      {showName && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-text">All Nations University</span>
          <span className="block truncate text-xs text-muted">Campus platform</span>
        </span>
      )}
    </div>
  );
}
