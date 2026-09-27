'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import { attendanceApi, type CheckInScreen as Screen } from '../api';

/**
 * Made for a projector: a large rotating code, a QR code and a live count.
 * The code changes every 30 seconds, so a code sent to someone outside the room soon stops working.
 */
export function CheckInScreen({ offeringId, sessionId, onClose }: { offeringId: string; sessionId: string; onClose: () => void }) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = () =>
      attendanceApi
        .checkInScreen(offeringId, sessionId)
        .then((s) => active && setScreen(s))
        .catch((err) => active && setError(errorMessage(err)));
    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [offeringId, sessionId]);

  const close = async () => {
    setClosing(true);
    try {
      await attendanceApi.closeCheckIn(offeringId, sessionId);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setClosing(false);
    }
  };

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!screen) return null;

  if (!screen.open) {
    return (
      <Alert tone="info" title="Check-in has closed">
        {screen.checkedIn} of {screen.rosterSize} students checked in. Everyone else was marked absent, or excused if they have an excuse.
      </Alert>
    );
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-4 py-6 text-center">
      <p className="text-sm text-muted">Go to Attendance in the student portal and enter this code, or scan the QR code.</p>
      <p className="font-mono text-6xl font-bold tracking-[0.2em] text-text sm:text-7xl" aria-live="polite">{screen.code}</p>
      <p className="text-xs text-muted">New code in {screen.secondsLeft} seconds</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {screen.qrDataUrl && <img src={screen.qrDataUrl} alt="QR code that opens check-in" width={220} height={220} className="rounded bg-white p-2" />}
      <p className="text-2xl font-semibold tabular-nums">
        {screen.checkedIn} <span className="text-base font-normal text-muted">of {screen.rosterSize} checked in</span>
      </p>
      {screen.closesAt && (
        <p className="text-xs text-muted">Closes automatically at {new Date(screen.closesAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' })}</p>
      )}
      <Button variant="secondary" loading={closing} onClick={close}>Close check-in now</Button>
    </section>
  );
}
