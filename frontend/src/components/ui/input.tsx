import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-text placeholder:text-muted sm:text-sm',
        'aria-[invalid=true]:border-danger disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-text sm:text-sm aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn('min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-text sm:text-sm aria-[invalid=true]:border-danger', className)}
      {...props}
    />
  );
}
