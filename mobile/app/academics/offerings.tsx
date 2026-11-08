import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { offeringsApi, type DepartmentOption, type LecturerOption, type Offering } from '@/api/offerings';
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
import { LecturerPicker } from '@/features/offerings/LecturerPicker';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { useTheme } from '@/theme/useTheme';

export default function Offerings() {
  const { space } = useTheme();
  const depts = useQuery<DepartmentOption[]>('off.depts', '/offerings/departments');
  const [dept, setDept] = useState<string | null>(null);
  const departmentId = dept ?? depts.data?.[0]?.id ?? '';
  return (
    <Screen refreshing={depts.loading} onRefresh={depts.refresh}>
      <Header title="Course offerings" subtitle="The courses taught this term, their lecturers and class sizes." />
      <QueryView q={depts} skeleton={<SkeletonList rows={2} />}>
        {(list) => list.length === 0 ? <EmptyState title="No departments" why="You can manage offerings for departments you lead." /> : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{list.map((d) => <Chip key={d.id} label={d.name} selected={departmentId === d.id} onPress={() => setDept(d.id)} />)}</ScrollView>
            {departmentId ? <Department departmentId={departmentId} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Department({ departmentId }: { departmentId: string }) {
  const q = useQuery<{ semester: { id: string; label: string }; items: Offering[] }>(`off.list.${departmentId}`, '/offerings', { departmentId });
  const lecturers = useQuery<LecturerOption[]>('off.lecturers', '/offerings/lecturer-options');
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={5} />}>
      {(d) => (
        <>
          <FormError error={error} />
          {msg ? <Notice tone="success">{msg}</Notice> : null}
          <Button label="Offer all this department's courses for the term" variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await offeringsApi.createForDepartment(d.semester.id, departmentId); setMsg(`${r.created} added, ${r.alreadyOffered} already offered.`); q.refresh(); })} />
          {d.items.length === 0 ? <EmptyState title="Nothing offered yet" why={`No courses are offered for ${d.semester.label} yet. Offer them with the button above.`} /> : d.items.map((o) => <OfferingCard key={o.id} o={o} options={lecturers.data ?? []} onChange={q.refresh} />)}
        </>
      )}
    </QueryView>
  );
}

function OfferingCard({ o, options, onChange }: { o: Offering; options: LecturerOption[]; onChange: () => void }) {
  const { space } = useTheme();
  const [mode, setMode] = useState<null | 'lecturers' | 'capacity'>(null);
  const [cap, setCap] = useState(o.capacity ? String(o.capacity) : '');
  const { busy, error, run } = useSubmit();
  const capError = cap && !(Number.isInteger(Number(cap)) && Number(cap) >= Math.max(1, o.enrolled)) ? `A whole number, at least ${Math.max(1, o.enrolled)} (already enrolled).` : null;
  return (
    <Card>
      <Text variant="heading">{o.course.code} {o.course.title}</Text>
      <Text variant="small" tone="muted">{o.enrolled} enrolled{o.capacity ? ` of ${o.capacity}` : ', no limit'}. {o.lecturers.length ? o.lecturers.map((l) => `${l.name}${l.isLead ? ' (lead)' : ''}`).join(', ') : 'No lecturer yet'}.</Text>
      <FormError error={error} />
      {mode === 'lecturers' ? <LecturerPicker o={o} options={options} onDone={() => { setMode(null); onChange(); }} /> : mode === 'capacity' ? (
        <View style={{ gap: space.sm }}>
          <TextField label="Class size limit" value={cap} keyboardType="number-pad" onChangeText={setCap} hint="Empty means no limit." error={capError} />
          <Button label="Save" disabled={!!capError} loading={busy} onPress={() => void run(async () => { await offeringsApi.updateCapacity(o.id, cap ? Number(cap) : null); setMode(null); onChange(); })} />
          <Button label="Cancel" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button label="Lecturers" variant="secondary" onPress={() => setMode('lecturers')} /></View>
          <View style={{ flex: 1 }}><Button label="Class size" variant="secondary" onPress={() => setMode('capacity')} /></View>
        </View>
      )}
    </Card>
  );
}
