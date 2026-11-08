import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Offering, RosterStudent } from '@/api/offerings';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { AttendanceTab } from '@/features/teaching/AttendanceTab';
import { MarksTab } from '@/features/teaching/MarksTab';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

export default function ClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space } = useTheme();
  const [tab, setTab] = useState<'attendance' | 'marks' | 'students'>('attendance');
  const roster = useQuery<{ offering: Offering; semesterLabel: string; students: RosterStudent[] }>(`teach.roster.${id}`, `/teaching/classes/${id}/roster`);
  const c = roster.data?.offering.course;
  return (
    <Screen>
      <Header title={c ? `${c.code} ${c.title}` : 'Class'} subtitle={roster.data?.semesterLabel} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Attendance" selected={tab === 'attendance'} onPress={() => setTab('attendance')} />
        <Chip label="Marks" selected={tab === 'marks'} onPress={() => setTab('marks')} />
        <Chip label="Students" selected={tab === 'students'} onPress={() => setTab('students')} />
      </View>
      {tab === 'attendance' ? <AttendanceTab offeringId={id} /> : tab === 'marks' ? <MarksTab offeringId={id} /> : (
        <QueryView q={roster} skeleton={<SkeletonList rows={8} />}>
          {(r) => r.students.length === 0 ? <EmptyState title="No students yet" why="Students appear once their course registration is approved." /> : <>{r.students.map((s) => (
            <Card key={s.id} style={{ padding: 10 }}>
              <Text variant="label">{s.firstName} {s.lastName}</Text>
              <Text variant="small" tone="muted">{s.indexNumber}{s.studentProfile ? `, ${s.studentProfile.programme.code} level ${s.studentProfile.currentLevel}` : ''}</Text>
            </Card>
          ))}</>}
        </QueryView>
      )}
    </Screen>
  );
}
