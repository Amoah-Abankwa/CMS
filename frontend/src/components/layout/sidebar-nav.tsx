'use client';

import { useAuthStore } from '@/stores/auth.store';
import { visibleNav } from '@/lib/nav';
import { cn } from '@/lib/cn';
import { SidebarLink } from './sidebar-link';

export function SidebarNav({
  collapsed,
  onNavigateAction,
}: {
  collapsed: boolean;
  onNavigateAction?: () => void;
}) {
  const me = useAuthStore((s) => s.me);
  const sections = visibleNav(
    me?.permissions ?? [],
    me?.type,
  );

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-5"
    >
      {sections.map((section, sectionIndex) => (
        <div key={`${section.label}-${sectionIndex}`}>
          <p
            className={cn(
              'mb-1 px-3 text-xs font-medium text-muted',
              collapsed && 'sr-only',
            )}
          >
            {section.label}
          </p>

          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarLink
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigateAction}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}