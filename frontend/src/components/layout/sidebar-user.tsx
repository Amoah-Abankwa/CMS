'use client';

import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';
import { RoleSwitcher } from './role-switcher';

/** Name and active role at the top of the sidebar. Users with several roles can switch here. */
export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const me = useAuthStore((s) => s.me);
  if (!me) return null;
  const initials = `${me.firstName[0] ?? ''}${me.lastName[0] ?? ''}`.toUpperCase();
  const activeRole = me.roles.find((r) => r.key === me.activeRoleKey);

  if (collapsed) {
    return (
      <div className="flex justify-center border-b border-border py-3">
        {me.photoUrl ? <img src={me.photoUrl} alt={`${me.firstName} ${me.lastName}`} title={`${me.firstName} ${me.lastName}, ${activeRole?.name ?? ''}`} className="size-9 rounded-full object-cover" /> : (
          <span title={`${me.firstName} ${me.lastName}, ${activeRole?.name ?? ''}`} className="grid size-9 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-text">
            {initials}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('border-b border-border px-4 py-3')}>
      <p className="flex items-center gap-2 truncate text-sm font-semibold text-text">
        {me.photoUrl && <img src={me.photoUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />}
        <span className="truncate">{me.firstName} {me.lastName}</span>
      </p>
      <p className="truncate text-xs text-muted">{me.indexNumber ?? me.email}</p>
      <div className="mt-2">
        <RoleSwitcher />
      </div>
    </div>
  );
}
