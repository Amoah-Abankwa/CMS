'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore, loginPathForLastUser } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api';

export function UserMenu() {
  const me = useAuthStore((s) => s.me);
  const markSignedOut = useAuthStore((s) => s.markSignedOut);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) return null;

  const signOut = async () => {
    const target = loginPathForLastUser();
    await authApi.logout().catch(() => undefined);
    markSignedOut();
    router.replace(target);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-md px-2 text-sm text-text hover:bg-surface-muted"
      >
        <span className="grid size-8 place-items-center rounded-full bg-surface-muted text-xs font-semibold">
          {`${me.firstName[0] ?? ''}${me.lastName[0] ?? ''}`.toUpperCase()}
        </span>
        <span className="hidden max-w-40 truncate md:inline">{me.firstName}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-border bg-surface py-1">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">
              {me.firstName} {me.lastName}
            </p>
            <p className="truncate text-xs text-muted">{me.indexNumber ?? me.email}</p>
          </div>
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2 px-3 text-sm hover:bg-surface-muted">
            <ShieldCheck className="size-4 text-muted" aria-hidden />
            Account and security
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="flex h-10 w-full items-center gap-2 px-3 text-sm text-danger hover:bg-surface-muted">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
