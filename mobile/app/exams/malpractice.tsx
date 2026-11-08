import { useState } from 'react';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/hooks/useDraft';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';

interface Case { id: string; occurredOn: string; offence: string; sanction: string | null; student: { firstName: string; lastName: string; indexNumber: string | null }; offering: { course: { code: string } } | null }

export default function Malpractice() {
  const q = useQuery<{ rows: Case[] }>('exams.malpractice', '/malpractice');
  const draft = useDraft('malpractice.new', { indexNumber: '', courseCode: '', occurredOn: new Date().toISOString().slice(0, 10), offence: '', sanction: '' });
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const v = draft.value;
  const errs = { index: !/^[A-Za-z]{2,6}\d{6,9}$/.test(v.indexNumber.trim()) ? 'An index number looks like ANU25400001.' : null, date: !/^\d{4}-\d{2}-\d{2}$/.test(v.occurredOn) ? 'YYYY-MM-DD.' : null, offence: v.offence.trim().length < 5 ? 'Describe what happened (at least 5 characters).' : null };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam malpractice" subtitle="Seen by the Registrar, the student's Head of Department and Registration Officers." />
      {done ? <SuccessState title="Case recorded" reassurance="It is in the student's registration records." next="Add a sanction later from the website once it is decided." action={{ label: 'Record another', onPress: () => setDone(false) }} /> : (
        <Card>
          <FormError error={error} />
          <TextField label="Index number" value={v.indexNumber} autoCapitalize="characters" onChangeText={(x) => draft.set('indexNumber', x)} error={touched ? errs.index : null} />
          <TextField label="Course (optional)" value={v.courseCode} autoCapitalize="characters" placeholder="CSC 201" onChangeText={(x) => draft.set('courseCode', x)} />
          <TextField label="Date" value={v.occurredOn} onChangeText={(x) => draft.set('occurredOn', x)} error={touched ? errs.date : null} />
          <TextField label="What happened" value={v.offence} multiline onChangeText={(x) => draft.set('offence', x)} error={touched ? errs.offence : null} />
          <TextField label="Sanction (optional)" value={v.sanction} onChangeText={(x) => draft.set('sanction', x)} />
          <Button label="Record case" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { await axiosInstance.post('/malpractice', { indexNumber: v.indexNumber.trim().toUpperCase(), courseCode: v.courseCode.trim() || undefined, occurredOn: v.occurredOn, offence: v.offence.trim(), sanction: v.sanction.trim() || undefined }); draft.clear(); setTouched(false); setDone(true); q.refresh(); }); }} />
        </Card>
      )}
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(d) => d.rows.length === 0 ? <EmptyState title="No cases this semester" why="Cases you record appear here." /> : <>{d.rows.map((c) => (
          <Card key={c.id} style={{ padding: 10 }}>
            <Text variant="label">{c.student.firstName} {c.student.lastName}{c.offering ? `, ${c.offering.course.code}` : ''}</Text>
            <Text variant="small" tone="muted">{c.occurredOn.slice(0, 10)}</Text>
            <Text>{c.offence}</Text>
            {c.sanction ? <Text variant="small">Sanction: {c.sanction}</Text> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
