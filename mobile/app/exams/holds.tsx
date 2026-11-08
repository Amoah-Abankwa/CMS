import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { examsApi, type Hold, type HoldCategory } from '@/api/exams';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

const CAT: Record<HoldCategory, string> = { DISCIPLINARY: 'Disciplinary', ACADEMIC_MISCONDUCT: 'Academic misconduct', ADMINISTRATIVE: 'Administrative', OTHER: 'Other' };

export default function Holds() {
  const q = useQuery<{ items: Hold[] }>('exams.holds', '/exams/holds');
  const [lifting, setLifting] = useState<{ id: string; reason: string } | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam holds" subtitle="A hold stops a student sitting a paper (or all papers) until it is lifted." />
      <PlaceHold onPlaced={q.refresh} />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No holds" why="No student is held from exams this semester." /> : <>{d.items.map((h) => (
          <Card key={h.id}>
            <Text variant="label">{h.student.firstName} {h.student.lastName} <Text variant="small" tone="muted">{h.student.indexNumber}</Text></Text>
            <Text variant="small">{CAT[h.category]}: {h.offering ? h.offering.course.code : 'all papers'}. {h.reason}</Text>
            {h.liftedAt ? <Badge label={`Lifted: ${h.liftReason ?? ''}`} /> : lifting?.id === h.id ? (
              <View style={{ gap: 4 }}>
                <TextField label="Why it is lifted" value={lifting.reason} onChangeText={(x) => setLifting({ ...lifting, reason: x })} error={lifting.reason && lifting.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
                <Button label="Lift the hold" disabled={lifting.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await examsApi.liftHold(h.id, lifting.reason.trim()); setLifting(null); q.refresh(); })} />
              </View>
            ) : <Button label="Lift" variant="ghost" onPress={() => setLifting({ id: h.id, reason: '' })} />}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}

function PlaceHold({ onPlaced }: { onPlaced: () => void }) {
  const { space } = useTheme();
  const [index, setIndex] = useState('');
  const [student, setStudent] = useState<Awaited<ReturnType<typeof examsApi.holdStudent>> | null>(null);
  const [f, setF] = useState({ offeringId: '', category: 'ADMINISTRATIVE' as HoldCategory, reason: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const bad = index && !/^[A-Za-z]{2,6}\d{6,9}$/.test(index.trim()) ? 'An index number looks like ANU25400001.' : null;
  return (
    <Card>
      <Text variant="heading">Place a hold</Text>
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      {!student ? (
        <>
          <TextField label="Index number" value={index} autoCapitalize="characters" onChangeText={setIndex} error={bad} />
          <Button label="Find the student" variant="secondary" disabled={!index || !!bad} loading={busy} onPress={() => void run(async () => setStudent(await examsApi.holdStudent(index.trim().toUpperCase())))} />
        </>
      ) : (
        <>
          <Text variant="label">{student.student.firstName} {student.student.lastName}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="All papers" selected={!f.offeringId} onPress={() => setF({ ...f, offeringId: '' })} />
            {student.offerings.map((o) => <Chip key={o.id} label={o.course.code} selected={f.offeringId === o.id} onPress={() => setF({ ...f, offeringId: o.id })} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(CAT) as HoldCategory[]).map((c) => <Chip key={c} label={CAT[c]} selected={f.category === c} onPress={() => setF({ ...f, category: c })} />)}</View>
          <TextField label="Reason (the student sees it)" value={f.reason} onChangeText={(x) => setF({ ...f, reason: x })} error={f.reason && f.reason.trim().length < 5 ? 'At least 5 characters.' : null} />
          <Button label="Place hold" disabled={f.reason.trim().length < 5} loading={busy} onPress={() => void run(async () => { await examsApi.placeHold({ indexNumber: student.student.indexNumber, offeringId: f.offeringId || undefined, category: f.category, reason: f.reason.trim() }); setMsg(`Hold placed on ${student.student.firstName}.`); setStudent(null); setIndex(''); setF({ offeringId: '', category: 'ADMINISTRATIVE', reason: '' }); onPlaced(); })} />
          <Button label="Another student" variant="ghost" onPress={() => setStudent(null)} />
        </>
      )}
    </Card>
  );
}
