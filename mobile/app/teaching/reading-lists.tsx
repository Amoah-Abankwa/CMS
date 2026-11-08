import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { libraryApi, type TitleRow } from '@/api/library';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { describeError } from '@/lib/errors';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { SuccessState } from '@/components/states/SuccessState';
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
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

type Item = { titleId: string | null; label: string; citation?: string; importance: 'ESSENTIAL' | 'RECOMMENDED' };

export default function ReadingListsEditor() {
  const { space } = useTheme();
  const courses = useQuery<Array<{ id: string; code: string; title: string }>>('rl.editable', '/library/reading-lists/editable');
  const [course, setCourse] = useState<string | null>(null);
  const courseId = course ?? courses.data?.[0]?.id ?? '';
  return (
    <Screen refreshing={courses.loading} onRefresh={courses.refresh}>
      <Header title="Reading lists" subtitle="The books students need for your courses. Lists carry over from term to term." />
      <QueryView q={courses} skeleton={<SkeletonList rows={2} />}>
        {(list) => list.length === 0 ? <EmptyState title="No courses to edit" why="You can edit reading lists for courses you teach." /> : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>{list.map((c) => <Chip key={c.id} label={c.code} selected={courseId === c.id} onPress={() => setCourse(c.id)} />)}</ScrollView>
            {courseId ? <Editor key={courseId} courseId={courseId} /> : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Editor({ courseId }: { courseId: string }) {
  const { space } = useTheme();
  const q = useQuery<{ items: Array<{ citation: string | null; importance: 'ESSENTIAL' | 'RECOMMENDED'; title: { id: string; title: string } | null }> } | null>(`rl.${courseId}`, `/library/reading-lists/${courseId}`);
  const [items, setItems] = useState<Item[] | null>(null);
  const [find, setFind] = useState('');
  const [found, setFound] = useState<TitleRow[]>([]);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  useEffect(() => { if (q.data !== undefined && items === null) setItems((q.data?.items ?? []).map((i) => ({ titleId: i.title?.id ?? null, label: i.title?.title ?? i.citation ?? '', citation: i.citation ?? undefined, importance: i.importance }))); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (find.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => void libraryApi.search({ search: find.trim(), page: 1, pageSize: 8 }).then((r) => setFound(r.items)).catch(() => undefined), 300);
    return () => clearTimeout(t);
  }, [find]);
  if (saved) return <SuccessState title="Reading list saved" reassurance="Students on the course see it under Library, Reading lists." next="The librarian sees which essential books are short of copies." action={{ label: 'Keep editing', onPress: () => setSaved(false) }} />;
  if (items === null) return q.error ? <ErrorState error={describeError(q.error, q.online)} onRetry={q.refresh} /> : <SkeletonList rows={4} />;
  return (
    <View style={{ gap: space.md }}>
      <FormError error={error} />
      {items.length === 0 ? <EmptyState title="No books yet" why="Search the catalogue below to add books." /> : items.map((i, n) => (
        <Card key={`${i.titleId}${n}`} style={{ padding: 10 }}>
          <Text variant="label">{i.label}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Chip label={i.importance === 'ESSENTIAL' ? 'Essential' : 'Recommended'} selected={i.importance === 'ESSENTIAL'} onPress={() => setItems(items.map((x, m) => (m === n ? { ...x, importance: x.importance === 'ESSENTIAL' ? 'RECOMMENDED' : 'ESSENTIAL' } : x)))} />
            <Button label="Remove" variant="ghost" onPress={() => setItems(items.filter((_, m) => m !== n))} />
          </View>
        </Card>
      ))}
      <TextField label="Add from the catalogue" value={find} onChangeText={setFind} placeholder="Title or author" />
      {found.filter((t) => !items.some((i) => i.titleId === t.id)).map((t) => <Button key={t.id} label={`Add "${t.title}"`} variant="secondary" onPress={() => { setItems([...items, { titleId: t.id, label: t.title, importance: 'ESSENTIAL' }]); setFind(''); }} />)}
      <Button label="Save reading list" loading={busy} onPress={() => void run(async () => { await axiosInstance.put(`/library/reading-lists/${courseId}`, { items: items.map(({ label: _l, ...i }) => i) }); setSaved(true); })} />
    </View>
  );
}
