import { ScrollView, View } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

/** Choosing the main semester: its courses are ticked for you. */
export function StagePicker({ total, value, suggested, disabled, onChange }: { total: number; value: number; suggested: number; disabled: boolean; onChange: (n: number) => void }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label">Your main semester</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => <Chip key={n} label={`Semester ${n}${n === suggested ? ' (suggested)' : ''}`} selected={n === value} onPress={() => !disabled && onChange(n)} />)}
      </ScrollView>
      <Text variant="small" tone="muted">Its courses are ticked for you. You can add any course from the semesters below it.</Text>
    </View>
  );
}
