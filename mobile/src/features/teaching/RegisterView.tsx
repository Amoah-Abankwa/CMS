import { useState } from 'react';
import { View } from 'react-native';
import { attendanceApi, type Register } from '@/api/attendance';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';
import { CheckInCode } from './CheckInCode';

type Mark = 'PRESENT' | 'LATE' | 'ABSENT';

/** One session's register: open check-in, or mark each student; saved as a draft until sent. */
export function RegisterView({ offeringId, sessionId, onBack }: { offeringId: string; sessionId: string; onBack: () => void }) {
  const { space } = useTheme();
  const q = useQuery<Register>(`teach.register.${sessionId}`, `/teaching/classes/${offeringId}/sessions/${sessionId}/register`);
  const draft = useDraft<Record<string, Mark>>(`teach.register.${sessionId}`, {});
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  if (saved) return <SuccessState title="Register saved" reassurance="Attendance for this session is recorded." next="Students see it straight away; anyone below the minimum is flagged on the class page." action={{ label: 'Back to sessions', onPress: onBack }} />;
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
      {(r) => {
        const value = (id: string, current: Mark | null) => (draft.value[id] as Mark | undefined) ?? current ?? null;
        const missing = r.students.filter((s) => !s.excused && !value(s.id, s.status as Mark | null)).length;
        return (
          <View style={{ gap: space.md }}>
            <Button label="Back to sessions" variant="ghost" onPress={onBack} />
            {r.session.checkInOpen ? <CheckInCode offeringId={offeringId} sessionId={sessionId} onClosed={q.refresh} /> : (
              <Button label="Open check-in for 15 minutes" variant="secondary" loading={busy} onPress={() => void run(async () => { await attendanceApi.openCheckIn(offeringId, sessionId, 15); q.refresh(); })} />
            )}
            <FormError error={error} />
            {r.students.map((s) => (
              <Card key={s.id} style={{ padding: 10 }}>
                <Text variant="label">{s.firstName} {s.lastName}</Text>
                <Text variant="small" tone="muted">{s.indexNumber}{s.excused ? ', excused' : ''}{s.checkedInAt ? ', checked in' : ''}</Text>
                {!s.excused ? (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {(['PRESENT', 'LATE', 'ABSENT'] as Mark[]).map((m) => <Chip key={m} label={m === 'PRESENT' ? 'Present' : m === 'LATE' ? 'Late' : 'Absent'} selected={value(s.id, s.status as Mark | null) === m} onPress={() => draft.set(s.id, m)} />)}
                  </View>
                ) : null}
              </Card>
            ))}
            {missing ? <Text tone="warning">{missing} student{missing === 1 ? ' has' : 's have'} no mark yet. Mark everyone before saving.</Text> : null}
            <Button label="Save register" disabled={missing > 0} loading={busy} onPress={() => void run(async () => {
              await attendanceApi.saveRegister(offeringId, sessionId, r.students.filter((s) => !s.excused).map((s) => ({ studentId: s.id, status: value(s.id, s.status as Mark | null)! })));
              draft.clear(); setSaved(true);
            })} />
          </View>
        );
      }}
    </QueryView>
  );
}
