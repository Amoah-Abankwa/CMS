'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/cn';

const ALL_HREFS = NAV.flatMap((s) => s.items.map((i) => i.href));

/** Active on its own page and its sub-pages, unless a more specific menu item matches. */
function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !ALL_HREFS.some((h) => h !== href && h.startsWith(`${href}/`) && (pathname === h || pathname.startsWith(`${h}/`)));
}

export function SidebarLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-surface-muted hover:text-text',
        active && 'bg-primary-soft font-medium text-primary hover:bg-primary-soft hover:text-primary',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </Link>
  );
}
