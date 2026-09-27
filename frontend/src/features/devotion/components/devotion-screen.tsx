'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { cn } from '@/lib/cn';
import { clock, devotionApi, serviceDay, type Screen } from '../api';

/** For the projector in the auditorium. Refreshes every 3 seconds. */
export function DevotionScreen({ serviceId }: { serviceId: string }) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const tick = () => devotionApi.screen(serviceId).then((s) => active && setScreen(s)).catch((err) => active && setError(errorMessage(err)));
    void tick();
    const poll = window.setInterval(tick, 3000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearInterval(clockTimer);
    };
  }, [serviceId]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!screen) return <Spinner />;

  const message: Record<Screen['phase'], string> = {
    NOT_OPEN: `Check-in opens at ${clock(screen.opensAt)}`,
    EARLY: `Early until ${clock(screen.lateFrom)}`,
    LATE: `Late until ${clock(screen.endsAt)}`,
    ENDED: 'Devotion has ended',
    CANCELLED: 'This service was cancelled',
  };

  return (
    <div ref={ref} className="flex min-h-[70vh] flex-col items-center justify-center gap-5 rounded-lg border border-border bg-surface px-4 py-8 text-center">
      <div className="flex w-full items-center justify-between print:hidden">
        <p className="text-sm text-muted">{serviceDay(screen.date)}</p>
        <Button variant="ghost" size="sm" onClick={() => ref.current?.requestFullscreen?.()}>
          <Maximize className="size-4" aria-hidden /> Full screen
        </Button>
      </div>
      {screen.theme && <p className="text-xl font-medium">{screen.theme}</p>}
      <p className="text-5xl font-semibold tabular-nums">{now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
      <p className={cn('rounded-md px-4 py-2 text-lg font-medium', screen.phase === 'EARLY' ? 'bg-success-soft text-success' : screen.phase === 'LATE' ? 'bg-warning-soft text-warning' : 'bg-surface-muted text-muted')}>
        {message[screen.phase]}
      </p>
      {screen.code && (
        <>
          <p className="text-sm text-muted">Open Morning devotion in the student portal and enter this code, or scan the QR code</p>
          <p className="font-mono text-7xl font-bold tracking-[0.2em] sm:text-8xl" aria-live="polite">{screen.code}</p>
          <p className="text-xs text-muted">New code in {screen.secondsLeft} seconds</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {screen.qrDataUrl && <img src={screen.qrDataUrl} alt="QR code for devotion check-in" width={240} height={240} className="rounded bg-white p-2" />}
        </>
      )}
      <div className="flex gap-8 text-center">
        <div><p className="text-4xl font-semibold tabular-nums text-success">{screen.early}</p><p className="text-sm text-muted">early</p></div>
        <div><p className="text-4xl font-semibold tabular-nums text-warning">{screen.late}</p><p className="text-sm text-muted">late</p></div>
        <div><p className="text-4xl font-semibold tabular-nums">{screen.expected}</p><p className="text-sm text-muted">expected</p></div>
      </div>
    </div>
  );
}
