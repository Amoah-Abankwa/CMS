import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { AvailableOffering } from '@/api/registration';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

/** One course that can be ticked: core or elective, passed or trailing, and why it cannot be ticked if so. */
export function CourseOption({ o, checked, blocked, onToggle }: { o: AvailableOffering; checked: boolean; blocked: string | null; onToggle: () => void }) {
  const { colors, space, radius } = useTheme();
  const off = !!blocked && !checked;
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: off }} accessibilityHint={blocked ?? undefined} disabled={off} onPress={onToggle} style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: checked ? colors.primary : colors.border, opacity: off ? 0.6 : 1 }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.muted} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="label">{o.course.code} {o.course.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' }}>
          <Badge label={o.approvedForYou ? 'Approved for you' : o.isElective ? 'Elective' : 'Core'} tone={o.isElective ? 'neutral' : 'primary'} />
          {o.passed ? <Badge label="Passed" tone="success" /> : o.carryOver ? <Badge label="Trailing" tone="danger" /> : null}
          <Text variant="small" tone="muted">{o.course.creditHours} credits{o.stage > 0 ? `, semester ${o.stage}` : ''}</Text>
        </View>
        {blocked ? <Text variant="small" tone="danger">{blocked}</Text> : null}
      </View>
    </Pressable>
  );
}
