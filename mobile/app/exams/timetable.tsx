import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { examsApi, type TimetableView, type Venue } from '@/api/exams';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { Notice } from '@/components/states/Notice';
import { QueryView } from '@/components/states/QueryView';
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
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Timetable() {
  const q = useQuery<TimetableView>('exams.timetable', '/exams/timetable');
  const venues = useQuery<Venue[]>('exams.venues', '/exams/venues');
  const put = useCache((s) => s.put);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Exam timetable" subtitle={q.data ? `${q.data.semester.label}. ${q.data.timetable.status === 'PUBLISHED' ? `Published (version ${q.data.timetable.publishedVersion})` : 'Draft'}.` : undefined} />
      <FormError error={error} />
      {msg ? <Notice tone="success">{msg}</Notice> : null}
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(t) => (
          <>
            {t.issues.filter((i) => i.kind !== 'UNSCHEDULED').map((i, n) => <Notice key={n} tone={i.severity === 'error' ? 'danger' : 'warning'}>{i.message}</Notice>)}
            <Button label={t.timetable.status === 'PUBLISHED' ? `Publish ${t.pendingChanges} changes` : 'Publish the timetable'} disabled={t.issues.some((i) => i.severity === 'error') || (t.timetable.status === 'PUBLISHED' && !t.pendingChanges)} loading={busy} onPress={() => void run(async () => { const r = await examsApi.publishTimetable(t.semester.id); put('exams.timetable', r); setMsg(`Published. ${r.notified ?? 0} students and invigilators told.`); })} />
            {t.issues.some((i) => i.severity === 'error') ? <Text variant="small" tone="danger">Fix the problems above before publishing.</Text> : null}
            {t.sessions.length === 0 ? <EmptyState title="No papers scheduled" why="Add papers below for the courses that have students." /> : t.sessions.map((p) => (
              <Card key={p.id} style={{ padding: 12 }}>
                <Text variant="label">{p.course.code} {p.course.title}</Text>
                <Text variant="small" tone="muted">{when(p.startsAt)}, {p.durationMinutes} min, {p.venue?.name ?? 'no venue'}. {p.students} students.{p.changedSincePublish ? ' Changed since publishing.' : ''}</Text>
                <Button label="Remove" variant="ghost" loading={busy} onPress={() => void run(async () => put('exams.timetable', await examsApi.removePaper(p.id)))} />
              </Card>
            ))}
            {t.unscheduled.length ? <AddPaper t={t} venues={venues.data ?? []} onSaved={(r) => put('exams.timetable', r)} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function AddPaper({ t, venues, onSaved }: { t: TimetableView; venues: Venue[]; onSaved: (r: TimetableView) => void }) {
  const { space } = useTheme();
  const [f, setF] = useState({ offeringId: '', date: '', time: '09:00', minutes: '120', venueId: '' });
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useSubmit();
  const errs = { course: f.offeringId ? null : 'Choose the course.', date: /^\d{4}-\d{2}-\d{2}$/.test(f.date) ? null : 'Date as YYYY-MM-DD.', time: /^([01]\d|2[0-3]):[0-5]\d$/.test(f.time) ? null : 'Start as HH:MM.', minutes: Number(f.minutes) >= 30 && Number(f.minutes) <= 360 ? null : 'Between 30 and 360 minutes.' };
  return (
    <Card>
      <Text variant="heading">Schedule a paper ({t.unscheduled.length} left)</Text>
      <FormError error={error} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {t.unscheduled.map((u) => <Chip key={u.offeringId} label={`${u.course.code} (${u.students})`} selected={f.offeringId === u.offeringId} onPress={() => setF({ ...f, offeringId: u.offeringId })} />)}
      </ScrollView>
      {touched && errs.course ? <Text variant="small" tone="danger">{errs.course}</Text> : null}
      <TextField label="Date" value={f.date} placeholder="YYYY-MM-DD" onChangeText={(x) => setF({ ...f, date: x })} error={touched ? errs.date : null} />
      <TextField label="Starts" value={f.time} onChangeText={(x) => setF({ ...f, time: x })} error={touched ? errs.time : null} />
      <TextField label="Length (minutes)" value={f.minutes} keyboardType="number-pad" onChangeText={(x) => setF({ ...f, minutes: x })} error={touched ? errs.minutes : null} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {venues.filter((v) => v.isActive).map((v) => <Chip key={v.id} label={`${v.name} (${v.capacity})`} selected={f.venueId === v.id} onPress={() => setF({ ...f, venueId: v.id })} />)}
      </ScrollView>
      <Button label="Add paper" loading={busy} onPress={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) void run(async () => { onSaved(await examsApi.savePaper({ offeringId: f.offeringId, startsAt: new Date(`${f.date}T${f.time}:00`).toISOString(), durationMinutes: Number(f.minutes), venueId: f.venueId || null, invigilatorIds: [] })); setF({ ...f, offeringId: '' }); setTouched(false); }); }} />
      <Text variant="small" tone="muted">Clashes and full halls show at the top after saving. Assign invigilators on the website.</Text>
    </Card>
  );
}
