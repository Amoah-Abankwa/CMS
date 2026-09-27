'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../api';

const POLL_MS = 60_000;

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const load = () =>
      notificationsApi
        .list(1, 1)
        .then((d) => active && setUnread(d.unread))
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      className="relative grid size-10 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-text"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
