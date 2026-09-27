'use client';

import { Menu } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { BrandMark } from './brand-mark';

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Topbar() {
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 print:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-muted lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <BrandMark showName={false} className="lg:hidden" />
      {DEMO && (
        <span className="ml-1 hidden rounded border border-warning/40 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning sm:inline">
          Demonstration data
        </span>
      )}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
