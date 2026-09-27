import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/layout/brand-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/login" aria-label="All Nations University home">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border border-border bg-surface px-5 py-6 sm:px-6">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
