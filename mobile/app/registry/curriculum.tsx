import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
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
import { CourseForm } from '@/features/curriculum/CourseForm';
import type { Course, Curriculum } from '@/features/curriculum/types';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { matches } from '@/lib/search';
import { useCache } from '@/stores/cache';
import { useTheme } from '@/theme/useTheme';

export default function CurriculumScreen() {
  const { space } = useTheme();
  const [tab, setTab] = useState<'programmes' | 'courses'>('programmes');
  return (
    <Screen>
      <Header title="Courses and curriculum" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Programme curriculum" selected={tab === 'programmes'} onPress={() => setTab('programmes')} />
        <Chip label="Courses" selected={tab === 'courses'} onPress={() => setTab('courses')} />
      </View>
      {tab === 'programmes' ? <Programmes /> : <Courses />}
    </Screen>
  );
}

function Courses() {
  const q = useQuery<Course[]>('cur.courses', '/curriculum/courses');
  const depts = useQuery<Array<{ id: string; name: string }>>('cur.depts', '/curriculum/departments');
  const [find, setFind] = useState('');
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  if (editing) return <CourseForm c={editing === 'new' ? null : editing} departments={depts.data ?? []} onDone={() => { setEditing(null); q.refresh(); }} />;
  return (
    <>
      <Button label="Add a course" onPress={() => setEditing('new')} />
      <TextField label="Find a course" value={find} onChangeText={setFind} placeholder="Code, title or department" />
      <QueryView q={q} skeleton={<SkeletonList rows={8} />}>
        {(list) => { const shown = list.filter((c) => !find.trim() || matches(`${c.code} ${c.title} ${c.department.name}`, find)); return shown.length === 0 ? <EmptyState title="No courses" why={find ? `Nothing matches "${find}".` : 'Add the first course.'} /> : <>{shown.slice(0, 100).map((c) => (
          <Card key={c.id} style={{ padding: 10 }}>
            <Text variant="label">{c.code} {c.title} {c.isActive ? '' : '(inactive)'}</Text>
            <Text variant="small" tone="muted">{c.department.name}, {c.creditHours} credits. In {c._count.curriculum} programmes.{c.prerequisites.length ? ` Needs ${c.prerequisites.map((p) => p.code).join(', ')}.` : ''}</Text>
            <Button label="Edit" variant="ghost" onPress={() => setEditing(c)} />
          </Card>
        ))}</>; }}
      </QueryView>
    </>
  );
}

function Programmes() {
  const { space } = useTheme();
  const programmes = useQuery<Array<{ id: string; name: string; _count: { curriculum: number } }>>('cur.programmes', '/curriculum/programmes');
  const [pid, setPid] = useState<string | null>(null);
  const id = pid ?? programmes.data?.[0]?.id ?? '';
  return (
    <QueryView q={programmes} skeleton={<SkeletonList rows={2} />}>
      {(list) => list.length === 0 ? <EmptyState title="No programmes" why="Add programmes under Academic structure first." /> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{list.map((p) => <Chip key={p.id} label={`${p.name} (${p._count.curriculum})`} selected={id === p.id} onPress={() => setPid(p.id)} />)}</ScrollView>
          {id ? <Programme key={id} id={id} /> : null}
        </>
      )}
    </QueryView>
  );
}

function Programme({ id }: { id: string }) {
  const { space } = useTheme();
  const key = `cur.programme.${id}`;
  const q = useQuery<Curriculum>(key, `/curriculum/programmes/${id}`);
  const courses = useQuery<Course[]>('cur.courses', '/curriculum/courses');
  const put = useCache((s) => s.put);
  const [add, setAdd] = useState({ stage: 1, find: '', elective: false });
  const { busy, error, run } = useSubmit();
  const place = (courseId: string, stage: number, isElective: boolean) => void run(async () => put(key, (await axiosInstance.put<Curriculum>(`/curriculum/programmes/${id}/courses`, { courseId, stage, isElective })).data));
  return (
    <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
      {(c) => {
        const stages = Array.from({ length: c.programme.totalStages }, (_, i) => i + 1);
        const options = (courses.data ?? []).filter((x) => x.isActive && !c.entries.some((e) => e.course.id === x.id) && add.find.trim() && matches(`${x.code} ${x.title}`, add.find)).slice(0, 8);
        return (
          <View style={{ gap: space.md }}>
            <Text variant="small" tone="muted">{c.programme.type}, {c.programme.department}. {c.programme.totalStages} semesters.</Text>
            <FormError error={error} />
            <Card>
              <Text variant="label">Add a course</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{stages.map((s) => <Chip key={s} label={`Semester ${s}`} selected={add.stage === s} onPress={() => setAdd({ ...add, stage: s })} />)}</ScrollView>
              <Chip label={add.elective ? 'Elective' : 'Core'} selected={!add.elective} onPress={() => setAdd({ ...add, elective: !add.elective })} />
              <TextField label="Find the course" value={add.find} onChangeText={(x) => setAdd({ ...add, find: x })} placeholder="Code or title" />
              {options.map((o) => <Button key={o.id} label={`Add ${o.code} ${o.title}`} variant="secondary" loading={busy} onPress={() => { place(o.id, add.stage, add.elective); setAdd({ ...add, find: '' }); }} />)}
            </Card>
            {stages.map((s) => {
              const rows = c.entries.filter((e) => e.stage === s);
              return (
                <View key={s} style={{ gap: space.xs }}>
                  <Text variant="heading">Semester {s} <Text variant="small" tone="muted">{rows.length} courses, {rows.reduce((t, e) => t + e.course.creditHours, 0)} credits</Text></Text>
                  {rows.map((e) => (
                    <Card key={e.course.id} style={{ padding: 10 }}>
                      <Text variant="label">{e.course.code} {e.course.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                        <Badge label={e.isElective ? 'Elective' : 'Core'} tone={e.isElective ? 'neutral' : 'primary'} />
                        <Button label={`Make ${e.isElective ? 'core' : 'elective'}`} variant="ghost" onPress={() => place(e.course.id, e.stage, !e.isElective)} />
                        {s > 1 ? <Button label="Earlier" variant="ghost" onPress={() => place(e.course.id, s - 1, e.isElective)} /> : null}
                        {s < c.programme.totalStages ? <Button label="Later" variant="ghost" onPress={() => place(e.course.id, s + 1, e.isElective)} /> : null}
                        <Button label="Remove" variant="ghost" onPress={() => void run(async () => put(key, (await axiosInstance.delete<Curriculum>(`/curriculum/programmes/${id}/courses/${e.course.id}`)).data))} />
                      </View>
                    </Card>
                  ))}
                </View>
              );
            })}
          </View>
        );
      }}
    </QueryView>
  );
}
