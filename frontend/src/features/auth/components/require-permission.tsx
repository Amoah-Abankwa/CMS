'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/states';

/** Hides a page from roles without the permission. The API enforces the same rule on every call. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useAuthStore((s) => s.can(permission));
  if (allowed) return <>{children}</>;
  return (
    <EmptyState
      title="You do not have access to this page"
      description="Your active role does not include this area. Switch role from the sidebar if you hold another one."
      action={
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      }
    />
  );
}
