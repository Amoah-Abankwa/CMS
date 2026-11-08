import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { NoResults } from '@/components/states/NoResults';
import { QueryView } from '@/components/states/QueryView';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { CourseRow, type MyCourse } from '@/features/courses/CourseRow';
import { DropForm, DropList, type Drop } from '@/features/courses/Drops';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@/hooks/useQuery';
import { didYouMean, matches, vocabulary } from '@/lib/search';
import { useTheme } from '@/theme/useTheme';

type Filter = 'ALL' | 'PASSED' | 'FAILED' | 'TRAILING' | 'CURRENT';
const LABEL: Record<Filter, string> = { ALL: 'All', PASSED: 'Passed', FAILED: 'Failed', TRAILING: 'Trailing', CURRENT: 'This term' };
const WHY: Record<Filter, string> = {
  ALL: 'Courses appear here once your course registration is approved.',
  PASSED: 'No published results show a pass yet. Results appear after your department publishes them.',
  FAILED: 'None of your published results is a fail.',
  TRAILING: 'You have no trailing courses: nothing failed is waiting to be passed.',
  CURRENT: 'Nothing is registered for this term yet, or your registration is still waiting for approval.',
};

interface Data { courses: MyCourse[]; trailing: Array<{ course: MyCourse['course']; term: string; grade: string | null; registeredThisTerm: boolean }> }

export default function Courses() {
  const { space } = useTheme();
  const q = useQuery<Data>('me.courses', '/me/registration/courses');
  const drops = useQuery<Drop[]>('me.drops', '/me/drops');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Text variant="title">My courses</Text>
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => (
          <>
            <DropList drops={drops.data ?? []} onChange={drops.refresh} />
            <CourseList d={d} drops={drops.data ?? []} onDropped={() => { drops.refresh(); q.refresh(); }} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} gap={space.sm} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function CourseList({ d, drops, onDropped, filter, setFilter, search, setSearch, gap }: { d: Data; drops: Drop[]; onDropped: () => void; filter: Filter; setFilter: (f: Filter) => void; search: string; setSearch: (s: string) => void; gap: number }) {
  const [dropping, setDropping] = useState<MyCourse | null>(null);
  const rows: MyCourse[] = filter === 'TRAILING'
    ? d.trailing.map((t) => ({ offeringId: t.course.id, course: t.course, term: `Last taken ${t.term}`, current: t.registeredThisTerm, status: 'FAILED', grade: t.grade }))
    : d.courses.filter((c) => filter === 'ALL' || (filter === 'CURRENT' ? c.current : c.status === filter));
  const words = useMemo(() => vocabulary([...d.courses, ...d.trailing].map((c) => `${c.course.code} ${c.course.title}`)), [d]);
  const shown = search.trim() ? rows.filter((c) => matches(`${c.course.code} ${c.course.title}`, search)) : rows;
  const firstCode = d.courses[0]?.course.code.split(' ')[0];
  return (
    <View style={{ gap }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap }}>
        {(Object.keys(LABEL) as Filter[]).map((f) => <Chip key={f} label={`${LABEL[f]} (${f === 'TRAILING' ? d.trailing.length : d.courses.filter((c) => f === 'ALL' || (f === 'CURRENT' ? c.current : c.status === f)).length})`} selected={filter === f} onPress={() => setFilter(f)} />)}
      </ScrollView>
      <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Code or title, e.g. CSC 201" autoCorrect={false} clearButtonMode="while-editing" />
      {rows.length === 0 ? (
        <EmptyState title={`No ${LABEL[filter].toLowerCase()} courses`} why={WHY[filter]} action={filter !== 'ALL' ? { label: 'Show all courses', onPress: () => setFilter('ALL') } : undefined} />
      ) : shown.length === 0 ? (
        <NoResults query={search} suggestion={didYouMean(search, words)} onSearch={setSearch} next={firstCode ? { label: `Show all ${firstCode} courses`, query: firstCode } : { label: 'Clear the search', query: '' }} />
      ) : (
        shown.map((c) => (
          <View key={`${c.offeringId}${c.term}`} style={{ gap: 4 }}>
            <CourseRow c={c} />
            {dropping?.offeringId === c.offeringId ? (
              <DropForm offeringId={c.offeringId} course={c.course.code} onCancel={() => setDropping(null)} onDone={() => { setDropping(null); onDropped(); }} />
            ) : c.current && c.status === 'IN_PROGRESS' && filter !== 'TRAILING' && !drops.some((x) => x.offering.id === c.offeringId && x.status === 'REQUESTED') ? (
              <Button label="Ask to drop" variant="ghost" onPress={() => setDropping(c)} />
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
