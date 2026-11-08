import { useEffect, useState } from 'react';
import { attendanceApi, type CheckInScreen } from '@/api/attendance';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useSubmit } from '@/hooks/useSubmit';
import { FormError } from '@/components/states/FormError';

/** The code to show the class, refreshing every few seconds with how many have checked in. */
export function CheckInCode({ offeringId, sessionId, onClosed }: { offeringId: string; sessionId: string; onClosed: () => void }) {
  const [s, setS] = useState<CheckInScreen | null>(null);
  const { busy, error, run } = useSubmit();
  useEffect(() => {
    let alive = true;
    const tick = () => void attendanceApi.checkInScreen(offeringId, sessionId).then((x) => alive && setS(x)).catch(() => undefined);
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [offeringId, sessionId]);
  return (
    <Card>
      <Text variant="small" tone="muted">Students check in with this code</Text>
      <Text style={{ fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: 6, textAlign: 'center' }} accessibilityLabel={`Code ${s?.code?.split('').join(' ') ?? ''}`}>{s?.code ?? '......'}</Text>
      <Text style={{ textAlign: 'center' }}>{s ? `${s.checkedIn} of ${s.rosterSize} checked in` : 'Loading'}{s?.secondsLeft ? `, closes in ${Math.ceil(s.secondsLeft / 60)} min` : ''}</Text>
      <FormError error={error} />
      <Button label="Close check-in" variant="secondary" loading={busy} onPress={() => void run(async () => { await attendanceApi.closeCheckIn(offeringId, sessionId); onClosed(); })} />
    </Card>
  );
}
