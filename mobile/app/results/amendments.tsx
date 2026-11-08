import { useState } from 'react';
import { View } from 'react-native';
import { termName } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { DecisionCard } from '@/features/approvals/DecisionCard';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

type Snap = { caScore: number; examScore: number; total: number; grade: string };
type Course = { course: { code: string; title: string }; semester: { number: number; academicYear: { label: string } } };
interface Amendment { id: string; reason: string; before: Snap; newCaScore: number; newExamScore: number; status: string; waitingFor: string | null; canAct: boolean; result: { student: { firstName: string; lastName: string; indexNumber: string | null }; sheet: { offering: Course } } }
interface Amendable { id: string; caScore: number; examScore: number; total: number; grade: string; student: { firstName: string; lastName: string }; sheet: { offering: Course }; amendments: Array<{ id: string }> }
const term = (o: Course) => `${o.semester.academicYear.label} ${termName(o.semester.number)}`;

export default function Amendments() {
  const q = useQuery<Amendment[]>('results.amendments', '/results/amendments');
  const act = async (id: string, approve: boolean, note?: string) => { await axiosInstance.post(`/results/amendments/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { note }); q.refresh(); };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Result amendments" subtitle="Corrections to published results, approved by the Head of Department and Dean, then applied." />
      <RequestAmendment onSent={q.refresh} />
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(list) => list.length === 0 ? <EmptyState title="No amendments" why="Requests to correct a published result appear here." /> : <>{list.map((a) => {
          const body = (
            <>
              <Text variant="label">{a.result.student.firstName} {a.result.student.lastName}, {a.result.sheet.offering.course.code}</Text>
              <Text variant="small" tone="muted">{term(a.result.sheet.offering)}. From {a.before.caScore} + {a.before.examScore} ({a.before.grade}) to {a.newCaScore} + {a.newExamScore}.</Text>
              <Text variant="small">{a.reason}</Text>
              {a.waitingFor ? <Text variant="small" tone="muted">Waiting for {a.waitingFor}.</Text> : null}
            </>
          );
          return a.canAct ? <DecisionCard key={a.id} approveLabel={a.status === 'DEAN_APPROVED' ? 'Apply' : 'Approve'} rejectLabel="Reject" onApprove={() => act(a.id, true)} onReject={(note) => act(a.id, false, note)}>{body}</DecisionCard> : <Card key={a.id}>{body}</Card>;
        })}</>}
      </QueryView>
    </Screen>
  );
}

function RequestAmendment({ onSent }: { onSent: () => void }) {
  const { space } = useTheme();
  const [find, setFind] = useState({ indexNumber: '', courseCode: '' });
  const [found, setFound] = useState<Amendable[] | null>(null);
  const [pick, setPick] = useState<Amendable | null>(null);
  const [f, setF] = useState({ ca: '', exam: '', reason: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  if (pick) {
    const errs = { ca: !(Number(f.ca) >= 0 && f.ca !== '') ? 'The corrected continuous assessment score.' : null, exam: !(Number(f.exam) >= 0 && f.exam !== '') ? 'The corrected exam score.' : null, reason: f.reason.trim().length < 10 ? 'Explain the correction (at least 10 characters).' : null };
    return (
      <Card>
        <Text variant="heading">Correct {pick.student.firstName}'s {pick.sheet.offering.course.code}</Text>
        <Text variant="small" tone="muted">Now {pick.caScore} + {pick.examScore} = {pick.total} ({pick.grade}).</Text>
        <FormError error={error} />
        <TextField label="Continuous assessment" value={f.ca} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, ca: x })} error={f.ca ? errs.ca : null} />
        <TextField label="Exam" value={f.exam} keyboardType="decimal-pad" onChangeText={(x) => setF({ ...f, exam: x })} error={f.exam ? errs.exam : null} />
        <TextField label="Reason" value={f.reason} multiline onChangeText={(x) => setF({ ...f, reason: x })} error={f.reason ? errs.reason : null} />
        <Button label="Send for approval" disabled={Object.values(errs).some(Boolean)} loading={busy} onPress={() => void run(async () => { await axiosInstance.post('/results/amendments', { resultId: pick.id, caScore: Number(f.ca), examScore: Number(f.exam), reason: f.reason.trim() }); setPick(null); setFound(null); setMsg('Sent to the Head of Department.'); onSent(); })} />
        <Button label="Cancel" variant="ghost" onPress={() => setPick(null)} />
      </Card>
    );
  }
  return (
    <Card>
      <Text variant="heading">Ask to correct a result</Text>
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <FormError error={error} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><TextField label="Index number" value={find.indexNumber} autoCapitalize="characters" onChangeText={(x) => setFind({ ...find, indexNumber: x })} /></View>
        <View style={{ flex: 1 }}><TextField label="Course code" value={find.courseCode} autoCapitalize="characters" onChangeText={(x) => setFind({ ...find, courseCode: x })} /></View>
      </View>
      <Button label="Find the result" variant="secondary" disabled={!find.indexNumber.trim() && !find.courseCode.trim()} loading={busy} onPress={() => void run(async () => setFound((await axiosInstance.get<Amendable[]>('/results/amendments/amendable', { params: { indexNumber: find.indexNumber.trim() || undefined, courseCode: find.courseCode.trim() || undefined } })).data))} />
      {found?.length === 0 ? <Text tone="muted">No published result matches. Check the index number and course code.</Text> : null}
      {found?.map((r) => <Button key={r.id} label={`${r.student.firstName} ${r.student.lastName}, ${r.sheet.offering.course.code} ${term(r.sheet.offering)}: ${r.grade}`} variant="ghost" disabled={r.amendments.length > 0} onPress={() => { setPick(r); setF({ ca: String(r.caScore), exam: String(r.examScore), reason: '' }); }} />)}
    </Card>
  );
}
