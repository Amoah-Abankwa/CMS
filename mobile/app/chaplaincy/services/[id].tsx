import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { devotionApi, type Screen as ServiceScreen } from '@/api/devotion';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSubmit } from '@/hooks/useSubmit';

const PHASE = { NOT_OPEN: 'Not open yet', EARLY: 'Open: arrivals are on time', LATE: 'Open: arrivals are late', ENDED: 'Ended', CANCELLED: 'Cancelled' } as const;

/** At the chapel entrance: the code for the screen, and checking students in by index number. */
export default function Door() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<ServiceScreen | null>(null);
  const [index, setIndex] = useState('');
  const [last, setLast] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  useEffect(() => {
    let alive = true;
    const tick = () => void devotionApi.screen(id).then((x) => alive && setS(x)).catch(() => undefined);
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);
  const indexError = index && !/^[A-Za-z]{2,6}\d{6,9}$/.test(index.trim()) ? 'An index number looks like ANU25400001.' : null;
  return (
    <Screen>
      <Header title="Chapel door" subtitle={s?.theme ?? undefined} />
      {!s ? <SkeletonCard lines={3} /> : (
        <Card>
          <Text variant="label">{PHASE[s.phase]}</Text>
          {s.code ? <Text style={{ fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: 6, textAlign: 'center' }}>{s.code}</Text> : null}
          <Text style={{ textAlign: 'center' }}>{s.early} on time, {s.late} late, of {s.expected} expected</Text>
        </Card>
      )}
      <Card>
        <Text variant="heading">Check a student in</Text>
        <FormError error={error} />
        {last ? <Notice tone="success">{last}</Notice> : null}
        <TextField label="Index number" value={index} autoCapitalize="characters" autoCorrect={false} onChangeText={setIndex} error={indexError} onSubmitEditing={() => undefined} />
        <Button label="Check in" disabled={!index || !!indexError} loading={busy} onPress={() => void run(async () => {
          const r = await devotionApi.door(id, index.trim().toUpperCase());
          setLast(`${r.student.firstName} ${r.student.lastName}: ${r.alreadyRecorded ? 'already recorded' : r.status === 'LATE' ? 'late' : 'on time'}.`);
          setIndex('');
        })} />
      </Card>
      {s && s.phase === 'ENDED' ? <Button label="Close the service (marks the rest absent)" variant="danger" loading={busy} onPress={() => void run(async () => { await devotionApi.close(id); setLast('Service closed. Students not checked in are marked absent.'); })} /> : null}
    </Screen>
  );
}
