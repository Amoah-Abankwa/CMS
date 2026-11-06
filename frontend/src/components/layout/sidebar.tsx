'use client';

import { useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api';
import { cn } from '@/lib/cn';
import { BrandMark } from './brand-mark';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';

/** Desktop: fixed rail that collapses to icons. Below lg: off-canvas drawer. */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const signedIn = useAuthStore((s) => s.status === 'authenticated');

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, setMobileOpen]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (signedIn) authApi.updatePreferences({ sidebarCollapsed: next }).catch(() => undefined);
  };

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex print:hidden',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-border px-4', collapsed && 'justify-center px-0')}>
          <BrandMark showName={!collapsed} />
        </div>
        <SidebarUser collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-surface-muted hover:text-text', collapsed && 'justify-center px-0')}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className={cn('fixed inset-0 z-40 lg:hidden', mobileOpen ? 'visible' : 'invisible')} aria-hidden={!mobileOpen}>
        <div
          className={cn('absolute inset-0 bg-black/50 transition-opacity', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <BrandMark />
            <button type="button" onClick={() => setMobileOpen(false)} className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-muted" aria-label="Close navigation">
              <X className="size-5" />
            </button>
          </div>
          <SidebarUser collapsed={false} />
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </aside>
      </div>
    </>
  );
}
