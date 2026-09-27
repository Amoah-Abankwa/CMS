'use client';

import type { ReactNode } from 'react';
import { useUiStore } from '@/stores/ui.store';
import { StepUpDialog } from '@/features/auth/components/step-up-dialog';
import { cn } from '@/lib/cn';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-full">
      <Sidebar />
      <div className={cn('flex min-h-full flex-col transition-[padding] duration-200 print:pl-0', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <StepUpDialog />
    </div>
  );
}
