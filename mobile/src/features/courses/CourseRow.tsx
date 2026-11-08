import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

export interface MyCourse { offeringId: string; course: { id: string; code: string; title: string; creditHours: number }; term: string; current: boolean; status: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'IN_PROGRESS'; grade: string | null }
const TONE = { PASSED: ['Passed', 'success'], FAILED: ['Failed', 'danger'], INCOMPLETE: ['Incomplete', 'warning'], IN_PROGRESS: ['In progress', 'primary'] } as const;

/** One course: passed in green, failed in red. */
export function CourseRow({ c }: { c: MyCourse }) {
  const { colors, space } = useTheme();
  const edge = c.status === 'PASSED' ? colors.success : c.status === 'FAILED' ? colors.danger : 'transparent';
  return (
    <View style={{ borderLeftWidth: 4, borderLeftColor: edge, backgroundColor: colors.surface, paddingVertical: space.md, paddingHorizontal: space.md, gap: 2, borderRadius: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="label" style={{ flex: 1 }}>{c.course.code} {c.course.title}</Text>
        {c.grade ? <Text variant="label">{c.grade}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="small" tone="muted">{c.term}, {c.course.creditHours} credits</Text>
        <Badge label={TONE[c.status][0]} tone={TONE[c.status][1]} />
      </View>
    </View>
  );
}
