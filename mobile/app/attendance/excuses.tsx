import { useState } from 'react';
import { View } from 'react-native';
import { attendanceApi, type Excuse, type ExcuseCategory } from '@/api/attendance';
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

const CAT: Record<ExcuseCategory, string> = { MEDICAL: 'Illness', BEREAVEMENT: 'Bereavement', OFFICIAL_DUTY: 'University duty', OTHER: 'Other' };
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function Excuses() {
  const { space } = useTheme();
  const q = useQuery<{ items: Excuse[] }>('excuses.list', '/attendance/excuses', { page: 1, pageSize: 50 });
  const [f, setF] = useState({ indexNumber: '', fromDate: '', toDate: '', category: 'MEDICAL' as ExcuseCategory, note: '' });
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const errs = { index: !/^[A-Za-z]{2,6}\d{6,9}$/.test(f.indexNumber.trim()) ? 'An index number looks like ANU25400001.' : null, from: !isDate(f.fromDate) ? 'YYYY-MM-DD.' : null, to: !isDate(f.toDate) || f.toDate < f.fromDate ? 'On or after the first day, as YYYY-MM-DD.' : null, note: f.note.trim().length < 5 ? 'Say what it is for (at least 5 characters).' : null };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Excused absences" subtitle="Excusing a student corrects their class attendance and devotion for those days." />
      <Card>
        <FormError error={error} />
        {msg ? <Notice tone="success">{msg}</Notice> : null}
        <TextField label="Index number" value={f.indexNumber} autoCapitalize="characters" onChangeText={(x) => setF({ ...f, indexNumber: x })} error={touched ? errs.index : null} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{(Object.keys(CAT) as ExcuseCategory[]).map((c) => <Chip key={c} label={CAT[c]} selected={f.category === c} onPress={() => setF({ ...f, category: c })} />)}</View>
        <TextField label="First day" value={f.fromDate} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...f, fromDate: x })} error={touched ? errs.from : null} />
        <TextField label="Last day" value={f.toDate} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...f, toDate: x })} error={touched ? errs.to : null} />
        <TextField label="Note" value={f.note} onChangeText={(x) => setF({ ...f, note: x })} error={touched ? errs.note : null} />
        <Button label="Excuse" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { const r = await attendanceApi.recordExcuse({ ...f, indexNumber: f.indexNumber.trim().toUpperCase(), note: f.note.trim() }); setMsg(`Excused. ${r.coursesAffected} courses corrected.`); setF({ indexNumber: '', fromDate: '', toDate: '', category: 'MEDICAL', note: '' }); setTouched(false); q.refresh(); }); }} />
      </Card>
      <QueryView q={q} skeleton={<SkeletonList rows={4} />}>
        {(d) => d.items.length === 0 ? <EmptyState title="No excused absences" why="Excuses you record, or approve from students' requests, appear here." /> : <>{d.items.map((e) => (
          <Card key={e.id} style={{ padding: 10 }}>
            <Text variant="label">{e.student.firstName} {e.student.lastName} <Text variant="small" tone="muted">{e.student.indexNumber}</Text></Text>
            <Text variant="small">{CAT[e.category]}: {e.fromDate.slice(0, 10)} to {e.toDate.slice(0, 10)}. {e.note}</Text>
            {e.revokedAt ? <Badge label={`Revoked: ${e.revokeReason ?? ''}`} tone="neutral" /> : null}
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
